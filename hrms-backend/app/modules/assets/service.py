"""Asset Management service on the 37-table schema: ``asset_categories`` (+ ``asset_category_os_platforms``),
``assets`` and ``asset_assignments``. ``asset_code`` is generated here (companies.asset_code_prefix + asset_number_seq).
History goes to ``activity_log`` (entity_type asset / asset_assignment). The API keeps the old camelCase names
(allocationId, systemAssetId, ...) but they are backed by AssetAssignment columns."""

from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.activity_writer import write_log
from app.core.roles import Status
from app.db.session import async_session_maker
from app.models.tables import (
    ActivityLog,
    Asset,
    AssetAssignment,
    AssetCategory,
    AssetCategoryOsPlatform,
    Company,
    Employee,
)
from app.modules.assets.constants import (
    ACTION_ASSIGNED,
    ACTION_CREATED,
    ACTION_DECOMMISSIONED,
    ACTION_FOUND,
    ACTION_REPORTED_LOST,
    ACTION_RETURNED,
    ACTION_RETURNED_TO_STOCK,
    ACTION_SWAPPED,
    ACTION_UNDER_REPAIR,
    ACTION_UPDATED,
    ASSET_CONDITIONS,
    ASSET_STATUS_ASSIGNED,
    ASSET_STATUS_DECOMMISSIONED,
    ASSET_STATUS_IN_STOCK,
    ASSET_STATUS_LOST,
    ASSET_STATUS_UNDER_REPAIR,
    ASSET_STATUSES,
    FOUND_CONDITIONS,
    LOST_REASONS,
    OS_PLATFORMS,
    OS_PLATFORMS_BY_CATEGORY,
    RETURN_REASONS,
    SEED_ASSET_CATEGORIES,
    SERIAL_REQUIRED_CATEGORIES,
    SWAP_REASONS,
    WARRANTY_EXPIRING_SOON_DAYS,
    allowed_os_platforms_for_category,
    normalize_optional_os_platform,
    normalize_optional_serial_number,
    normalize_optional_warranty_plan_type,
)
from app.modules.assets.notifications import (
    notify_asset_assigned,
    notify_asset_lost_or_found,
    notify_asset_returned,
    notify_asset_swapped,
)

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse_uuid(value: Any, field: str) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field} must be a valid UUID",
        ) from exc


def _parse_date(value: Any, field: str) -> date:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    text = str(value or "").strip()
    if not text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field} is required",
        )
    try:
        return date.fromisoformat(text[:10])
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field} must be YYYY-MM-DD",
        ) from exc


def _optional_date(value: Any, field: str) -> date | None:
    if value is None or str(value).strip() == "":
        return None
    return _parse_date(value, field)


def _optional_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def assert_exclusive_warranty_flags(
    *,
    warranty_expiring_soon: bool = False,
    warranty_expired: bool = False,
) -> None:
    """Soon (today…+30) and expired (before today) are mutually exclusive."""
    if warranty_expiring_soon and warranty_expired:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="warrantyExpired and warrantyExpiringSoon cannot both be true",
        )


def _resolve_warranty_expiry_bounds(
    *,
    warranty_expiring_soon: bool = False,
    warranty_expired: bool = False,
    warranty_expiry_from: str | None = None,
    warranty_expiry_to: str | None = None,
    today: date | None = None,
) -> tuple[date | None, date | None]:
    """Inclusive warranty-expiry range for GET /assets.

    ``warranty_expired`` (end date before today) and ``warranty_expiring_soon``
    (today through today + ``WARRANTY_EXPIRING_SOON_DAYS``) are exclusive;
    each wins over explicit ``warrantyExpiryFrom`` / ``warrantyExpiryTo``.
    """
    assert_exclusive_warranty_flags(
        warranty_expiring_soon=warranty_expiring_soon,
        warranty_expired=warranty_expired,
    )
    if warranty_expired:
        return None, None
    if warranty_expiring_soon:
        start = today or date.today()
        return start, start + timedelta(days=WARRANTY_EXPIRING_SOON_DAYS)
    return (
        _optional_date(warranty_expiry_from, "warrantyExpiryFrom"),
        _optional_date(warranty_expiry_to, "warrantyExpiryTo"),
    )


def warranty_expiry_is_expired(
    expiry: date | None,
    today: date | None = None,
) -> bool:
    """True when ``expiry`` is a calendar date strictly before today."""
    if expiry is None:
        return False
    return expiry < (today or date.today())


def warranty_expiry_in_range(
    expiry: date | None,
    start: date | None,
    end: date | None,
) -> bool:
    """True when ``expiry`` falls in the inclusive [start, end] window."""
    if start is None and end is None:
        return True
    if expiry is None:
        return False
    if start is not None and expiry < start:
        return False
    if end is not None and expiry > end:
        return False
    return True


def _resolve_patch_purchase_date(
    existing: date | None, incoming: date | None
) -> date | None:
    """PATCH purchaseDate: set only when currently blank; reject changes."""
    if existing is not None and incoming != existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="purchaseDate cannot be changed once it is set",
        )
    return existing if existing is not None else incoming


def _actor_name(actor: dict | None) -> str | None:
    if not actor:
        return None
    name = f"{actor.get('firstName', '')} {actor.get('lastName', '')}".strip()
    return name or actor.get("email") or None


def _actor_employee_id(actor: dict | None) -> uuid.UUID | None:
    if not actor:
        return None
    raw = actor.get("id") or actor.get("employeeId")
    if not raw:
        return None
    try:
        return uuid.UUID(str(raw))
    except ValueError:
        return None


def _employee_display_name(emp: Employee) -> str:
    return f"{emp.first_name} {emp.last_name}".strip() or emp.email_id


def _directory_search_terms(*raw_terms: str | None) -> list[str]:
    terms: list[str] = []
    seen: set[str] = set()
    for raw in raw_terms:
        text = (raw or "").strip()
        key = text.casefold()
        if text and key not in seen:
            seen.add(key)
            terms.append(text)
    return terms


def _asset_matches_search_clause(pattern: str):
    """Asset ID, employee name, category, or model (plus serial/OS/specs)."""
    full_name = func.concat_ws(
        " ",
        Employee.first_name,
        Employee.middle_name,
        Employee.last_name,
    )
    display_name = func.concat_ws(" ", Employee.first_name, Employee.last_name)
    emp_match = (
        select(AssetAssignment.asset_id)
        .join(Employee, Employee.id == AssetAssignment.assigned_to_employee_id)
        .where(
            AssetAssignment.returned_date.is_(None),
            or_(
                Employee.first_name.ilike(pattern),
                Employee.middle_name.ilike(pattern),
                Employee.last_name.ilike(pattern),
                full_name.ilike(pattern),
                display_name.ilike(pattern),
                Employee.email_id.ilike(pattern),
            ),
        )
    )
    category_match = select(AssetCategory.id).where(AssetCategory.name.ilike(pattern))
    return or_(
        Asset.asset_code.ilike(pattern),
        Asset.model.ilike(pattern),
        Asset.asset_category_id.in_(category_match),
        Asset.id.in_(emp_match),
        Asset.serial_number.ilike(pattern),
        Asset.os_platform.ilike(pattern),
        Asset.specifications.ilike(pattern),
    )


def category_to_dict(row: AssetCategory) -> dict:
    return {
        "categoryId": str(row.id),
        "categoryName": row.name,
    }


def allocation_to_dict(
    row: AssetAssignment,
    *,
    employee_name: str | None = None,
    asset_id: str | None = None,
    category_name: str | None = None,
    model: str | None = None,
    serial_number: str | None = None,
) -> dict:
    return {
        "allocationId": str(row.id),
        "systemAssetId": str(row.asset_id),
        "employeeId": str(row.assigned_to_employee_id),
        "employeeName": employee_name,
        "assetId": asset_id,
        "categoryName": category_name,
        "model": model,
        "serialNumber": serial_number,
        "allocatedDate": row.assigned_date.isoformat() if row.assigned_date else None,
        "returnedDate": row.returned_date.isoformat() if row.returned_date else None,
        "conditionAtReturn": row.condition_at_return,
        "reasonForReturn": row.return_reason,
        "reasonForReturnOther": row.return_note if row.return_reason == "Other" else None,
        "returnNotes": row.return_note,
        "swappedWithAllocationId": (
            str(row.replaces_assignment_id) if row.replaces_assignment_id else None
        ),
    }


def asset_to_dict(
    row: Asset,
    *,
    category_name: str | None = None,
    assigned_employee_id: str | None = None,
    assigned_employee_name: str | None = None,
    open_allocation_id: str | None = None,
) -> dict:
    receipt_name = getattr(row, "purchase_receipt_file_name", None)
    receipt_name = str(receipt_name).strip() if receipt_name else None
    return {
        "systemAssetId": str(row.id),
        "categoryId": str(row.asset_category_id),
        "categoryName": category_name,
        "assetId": row.asset_code,
        "serialNumber": row.serial_number,
        "model": row.model,
        "osPlatform": row.os_platform,
        "specifications": row.specifications,
        "purchaseDate": row.purchase_date.isoformat() if row.purchase_date else None,
        "warrantyExpiry": row.warranty_expiry.isoformat() if row.warranty_expiry else None,
        "warrantyPlanType": _optional_text(row.warranty_plan_type),
        "warrantyPlan": _optional_text(row.warranty_plan_number),
        "hasPurchaseReceipt": bool(getattr(row, "purchase_receipt_object_key", None)),
        "purchaseReceiptFileName": receipt_name or None,
        "condition": row.condition,
        "status": row.status,
        "assignedEmployeeId": assigned_employee_id,
        "assignedEmployeeName": assigned_employee_name,
        "openAllocationId": open_allocation_id,
    }


async def seed_default_asset_categories(db: AsyncSession) -> int:
    """Insert the starter categories when the table is empty (a brand-new DB), then make sure the OS-platform
    rows exist for the categories that have an OS field (Laptop, Mobile).

    A category that was later removed is not brought back (nothing is inserted once any category exists).
    Safe to call at startup and from the first list: inserts use ON CONFLICT DO NOTHING, so two callers at once
    cannot create duplicates. Returns the number of categories inserted.
    """
    added = 0
    has_any = await db.execute(select(AssetCategory.id).limit(1))
    if has_any.first() is None:
        result = await db.execute(
            pg_insert(AssetCategory)
            .values(
                [
                    {"name": name, "is_serial_required": name in SERIAL_REQUIRED_CATEGORIES}
                    for name in SEED_ASSET_CATEGORIES
                ]
            )
            .on_conflict_do_nothing(index_elements=["name"])
        )
        added = int(result.rowcount or 0)
    for category_name, platforms in OS_PLATFORMS_BY_CATEGORY.items():
        category_id = (
            await db.execute(select(AssetCategory.id).where(AssetCategory.name == category_name))
        ).scalar_one_or_none()
        if category_id is None:
            continue
        await db.execute(
            pg_insert(AssetCategoryOsPlatform)
            .values([{"asset_category_id": category_id, "os_platform": p} for p in sorted(platforms)])
            .on_conflict_do_nothing()
        )
    await db.flush()
    return added


# Backward-compatible alias used by older call sites / tests.
async def seed_asset_categories(db: AsyncSession) -> int:
    return await seed_default_asset_categories(db)


async def ensure_asset_catalog() -> int:
    """Startup hook: seed asset_categories (+ OS platforms) in their own transaction."""
    async with async_session_maker() as db:
        added = await seed_default_asset_categories(db)
        await db.commit()
    return added


# ------------------------------------------------------------------------------------------ activity log
# History goes to the shared activity_log (entity_type "asset" / "asset_assignment"), not to a table of its own.
_ACTIVITY_LABELS = {
    "created": ACTION_CREATED,
    "updated": ACTION_UPDATED,
    "assigned": ACTION_ASSIGNED,
    "returned": ACTION_RETURNED,
    "swapped": ACTION_SWAPPED,
    "sent_for_repair": ACTION_UNDER_REPAIR,
    "decommissioned": ACTION_DECOMMISSIONED,
    "reactivated": ACTION_RETURNED_TO_STOCK,
    "marked_lost": ACTION_REPORTED_LOST,
    "marked_found": ACTION_FOUND,
}

_ASSET_LOG_FIELDS = (
    "asset_category_id", "serial_number", "model", "os_platform", "condition", "status", "purchase_date",
    "warranty_expiry", "warranty_plan_type", "purchase_receipt_file_name",
)
_ASSIGNMENT_LOG_FIELDS = (
    "asset_id", "assigned_to_employee_id", "assigned_date", "returned_date", "return_reason",
    "condition_at_return", "replaces_assignment_id",
)


def _log_val(value: Any) -> Any:
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def _snap(row: Any, fields: tuple[str, ...]) -> dict[str, Any]:
    return {f: _log_val(getattr(row, f, None)) for f in fields}


def _diff(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    return {k: {"old": before.get(k), "new": v} for k, v in after.items() if before.get(k) != v}


async def _log(
    db: AsyncSession,
    actor: dict | None,
    entity_type: str,
    entity_id: uuid.UUID,
    action: str,
    details: dict[str, Any] | None = None,
) -> None:
    await write_log(
        db,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        actor_employee_id=_actor_employee_id(actor),
        details=details or None,
    )


def _integrity_to_http(exc: DBAPIError) -> HTTPException:
    message = str(getattr(exc, "orig", exc))
    if "uq_assets_serial_number" in message:
        return HTTPException(status_code=409, detail="serialNumber already exists on another asset")
    if "uq_asset_assignments_one_open" in message:
        return HTTPException(status_code=409, detail="Asset already has an open assignment")
    if "fk_assets_category_os" in message:
        return HTTPException(status_code=400, detail="osPlatform is not allowed for this category")
    if "fk_asset_assignments_assigned_to_employee_id" in message:
        return HTTPException(status_code=400, detail="employeeId must reference an existing employee")
    detail = message.splitlines()[0] if message else "Database rejected the change"
    # asyncpg prefixes the exception class: "<class 'asyncpg.exceptions.CheckViolationError'>: msg"
    if ">: " in detail:
        detail = detail.split(">: ", 1)[1]
    return HTTPException(status_code=400, detail=detail)


async def _flush(db: AsyncSession) -> None:
    try:
        await db.flush()
    except DBAPIError as exc:
        raise _integrity_to_http(exc) from exc


async def _safe_notify(coro: Any) -> None:
    """Email is best-effort: a notification problem never fails the asset operation."""
    try:
        await coro
    except Exception:  # noqa: BLE001
        logger.warning("asset notification skipped", exc_info=True)


async def list_categories(db: AsyncSession) -> list[dict]:
    # First list on a fresh database fills the fixed category list.
    await seed_default_asset_categories(db)
    stmt = select(AssetCategory).order_by(AssetCategory.name)
    result = await db.execute(stmt)
    return [category_to_dict(row) for row in result.scalars().all()]


async def list_asset_catalog_for_category(
    db: AsyncSession, category_id: str
) -> dict:
    """Unique in-company models/OS/specs for a category (ESS asset request)."""
    parsed = _parse_uuid(category_id, "categoryId")
    cat_result = await db.execute(
        select(AssetCategory).where(AssetCategory.id == parsed)
    )
    category = cat_result.scalar_one_or_none()
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="categoryId must reference an existing category",
        )
    allowed_os = allowed_os_platforms_for_category(category.name)
    stmt = select(Asset).where(
        Asset.asset_category_id == parsed,
        Asset.status.notin_((ASSET_STATUS_DECOMMISSIONED, ASSET_STATUS_LOST)),
    )
    result = await db.execute(stmt)
    models: dict[tuple[str, str], dict] = {}
    for asset in result.scalars().all():
        model = (asset.model or "").strip()
        if not model:
            continue
        specs = (asset.specifications or "").strip()
        os_value = (asset.os_platform or "").strip()
        key = (model.lower(), specs.lower())
        row = models.get(key)
        if row is None:
            row = {
                "id": f"{model}::{specs}",
                "model": model,
                "specifications": specs,
                "osPlatforms": set(),
            }
            models[key] = row
        elif specs and not row["specifications"]:
            row["specifications"] = specs
        if os_value and (not allowed_os or os_value in allowed_os):
            row["osPlatforms"].add(os_value)
    os_platforms = sorted(allowed_os) if allowed_os else []
    return {
        "categoryId": str(category.id),
        "categoryName": category.name,
        "osPlatforms": os_platforms,
        "models": [
            {
                "id": row["id"],
                "model": row["model"],
                "specifications": row["specifications"],
                "osPlatforms": sorted(row["osPlatforms"]),
            }
            for row in sorted(
                models.values(),
                key=lambda item: (item["model"].lower(), item["specifications"].lower()),
            )
        ],
    }


async def _category_map(db: AsyncSession) -> dict[uuid.UUID, AssetCategory]:
    result = await db.execute(select(AssetCategory))
    return {row.id: row for row in result.scalars().all()}


async def _open_allocations_by_asset(
    db: AsyncSession, asset_ids: list[uuid.UUID]
) -> dict[uuid.UUID, AssetAssignment]:
    if not asset_ids:
        return {}
    result = await db.execute(
        select(AssetAssignment).where(
            AssetAssignment.asset_id.in_(asset_ids),
            AssetAssignment.returned_date.is_(None),
        )
    )
    return {row.asset_id: row for row in result.scalars().all()}


async def _employees_by_id(
    db: AsyncSession, employee_ids: list[uuid.UUID]
) -> dict[uuid.UUID, Employee]:
    if not employee_ids:
        return {}
    result = await db.execute(select(Employee).where(Employee.id.in_(employee_ids)))
    return {row.id: row for row in result.scalars().all()}


async def _generate_asset_code(db: AsyncSession, actor: dict | None = None) -> str:
    """companies.asset_code_prefix + '-' + next asset_number_seq value padded to 5 digits."""
    company = (await db.execute(select(Company).limit(1))).scalar_one_or_none()
    prefix = ((company.asset_code_prefix if company else None) or "AST").strip() or "AST"
    n = await db.scalar(text("SELECT nextval('asset_number_seq')"))
    return f"{prefix}-{int(n):05d}"


async def list_assets(
    db: AsyncSession,
    *,
    category_id: str | None = None,
    status_filter: str | None = None,
    condition: str | None = None,
    q: str | None = None,
    employee_name: str | None = None,
    os_platform: str | None = None,
    purchase_date_from: str | None = None,
    purchase_date_to: str | None = None,
    warranty_expiry_from: str | None = None,
    warranty_expiry_to: str | None = None,
    warranty_expiring_soon: bool = False,
    warranty_expired: bool = False,
) -> list[dict]:
    assert_exclusive_warranty_flags(
        warranty_expiring_soon=warranty_expiring_soon,
        warranty_expired=warranty_expired,
    )
    # A fresh database has no categories yet: the first list fills the fixed list.
    await seed_default_asset_categories(db)
    stmt = select(Asset)
    if category_id:
        stmt = stmt.where(
            Asset.asset_category_id == _parse_uuid(category_id, "categoryId")
        )
    if status_filter:
        if status_filter not in ASSET_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"status must be one of: {', '.join(sorted(ASSET_STATUSES))}",
            )
        stmt = stmt.where(Asset.status == status_filter)
    if condition:
        if condition not in ASSET_CONDITIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"condition must be one of: {', '.join(sorted(ASSET_CONDITIONS))}",
            )
        stmt = stmt.where(Asset.condition == condition)
    if os_platform:
        platform = os_platform.strip()
        if platform not in OS_PLATFORMS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"osPlatform must be one of: {', '.join(sorted(OS_PLATFORMS))}",
            )
        stmt = stmt.where(Asset.os_platform == platform)
    purchase_from = _optional_date(purchase_date_from, "purchaseDateFrom")
    purchase_to = _optional_date(purchase_date_to, "purchaseDateTo")
    warranty_from, warranty_to = _resolve_warranty_expiry_bounds(
        warranty_expiring_soon=warranty_expiring_soon,
        warranty_expired=warranty_expired,
        warranty_expiry_from=warranty_expiry_from,
        warranty_expiry_to=warranty_expiry_to,
    )
    if purchase_from:
        stmt = stmt.where(Asset.purchase_date >= purchase_from)
    if purchase_to:
        stmt = stmt.where(Asset.purchase_date <= purchase_to)
    if warranty_expired:
        stmt = stmt.where(Asset.warranty_expiry < date.today())
    else:
        if warranty_from:
            stmt = stmt.where(Asset.warranty_expiry >= warranty_from)
        if warranty_to:
            stmt = stmt.where(Asset.warranty_expiry <= warranty_to)
    search_terms = _directory_search_terms(q, employee_name)
    if search_terms:
        stmt = stmt.where(
            or_(
                *[
                    _asset_matches_search_clause(f"%{term}%")
                    for term in search_terms
                ]
            )
        )
    stmt = stmt.order_by(Asset.asset_code)
    result = await db.execute(stmt)
    assets = list(result.scalars().all())
    categories = await _category_map(db)
    open_by_asset = await _open_allocations_by_asset(db, [a.id for a in assets])
    employees = await _employees_by_id(
        db, [alloc.assigned_to_employee_id for alloc in open_by_asset.values()]
    )
    out: list[dict] = []
    for asset in assets:
        cat = categories.get(asset.asset_category_id)
        open_alloc = open_by_asset.get(asset.id)
        emp = employees.get(open_alloc.assigned_to_employee_id) if open_alloc else None
        out.append(
            asset_to_dict(
                asset,
                category_name=cat.name if cat else None,
                assigned_employee_id=(
                    str(open_alloc.assigned_to_employee_id) if open_alloc else None
                ),
                assigned_employee_name=_employee_display_name(emp) if emp else None,
                open_allocation_id=str(open_alloc.id) if open_alloc else None,
            )
        )
    return out


async def get_asset(db: AsyncSession, system_asset_id: uuid.UUID) -> dict:
    return await _public_asset(db, await _require_asset(db, system_asset_id))


async def update_asset(
    db: AsyncSession, actor: dict, system_asset_id: uuid.UUID, payload: dict[str, Any]
) -> dict:
    """Patch descriptive fields only — never category, assetId, or status."""
    forbidden = [
        key
        for key in (
            "categoryId",
            "assetId",
            "assetCode",
            "assetTag",
            "status",
            "systemAssetId",
        )
        if key in payload
    ]
    if forbidden:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"{', '.join(forbidden)} cannot be changed via PATCH "
                "(use assign/return/decommission/return-to-stock for status; category/code are immutable)"
            ),
        )

    asset = await _require_asset(db, system_asset_id)
    category = (
        await db.execute(select(AssetCategory).where(AssetCategory.id == asset.asset_category_id))
    ).scalar_one_or_none()
    category_name = category.name if category else ""
    allowed = {
        "serialNumber",
        "model",
        "osPlatform",
        "specifications",
        "purchaseDate",
        "warrantyExpiry",
        "warrantyPlanType",
        "warrantyPlan",
        "condition",
        "ramStorage",  # legacy alias for specifications
    }
    if not any(key in payload for key in allowed):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Provide at least one of: serialNumber, model, osPlatform, "
                "specifications, purchaseDate, warrantyExpiry, warrantyPlanType, "
                "warrantyPlan, condition"
            ),
        )
    before = _snap(asset, _ASSET_LOG_FIELDS)

    if "serialNumber" in payload:
        try:
            asset.serial_number = normalize_optional_serial_number(
                payload.get("serialNumber"), category_name
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

    if "model" in payload:
        raw = payload.get("model")
        asset.model = None if raw is None else (str(raw).strip() or None)

    if "osPlatform" in payload:
        raw = payload.get("osPlatform")
        try:
            asset.os_platform = normalize_optional_os_platform(raw, category_name)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

    if "specifications" in payload or "ramStorage" in payload:
        raw = payload.get("specifications", payload.get("ramStorage"))
        asset.specifications = (
            None if raw is None else (str(raw).strip() or None)
        )

    if "condition" in payload:
        raw = payload.get("condition")
        if raw is None or str(raw).strip() == "":
            asset.condition = None
        else:
            condition = str(raw).strip()
            if condition not in ASSET_CONDITIONS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"condition must be one of: {', '.join(sorted(ASSET_CONDITIONS))}"
                    ),
                )
            asset.condition = condition

    if "purchaseDate" in payload:
        asset.purchase_date = _resolve_patch_purchase_date(
            asset.purchase_date,
            _optional_date(payload.get("purchaseDate"), "purchaseDate"),
        )
    if "warrantyExpiry" in payload:
        asset.warranty_expiry = _optional_date(
            payload.get("warrantyExpiry"), "warrantyExpiry"
        )
    if "warrantyPlanType" in payload:
        try:
            asset.warranty_plan_type = normalize_optional_warranty_plan_type(
                payload.get("warrantyPlanType")
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc
        if asset.warranty_plan_type is None:
            asset.warranty_plan_number = None
    if "warrantyPlan" in payload:
        if asset.warranty_plan_type:
            asset.warranty_plan_number = _optional_text(payload.get("warrantyPlan"))
        else:
            asset.warranty_plan_number = None
    if (
        asset.purchase_date
        and asset.warranty_expiry
        and asset.warranty_expiry < asset.purchase_date
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="warrantyExpiry must be on or after purchaseDate",
        )

    await _flush(db)
    diff = _diff(before, _snap(asset, _ASSET_LOG_FIELDS))
    if diff:
        await _log(db, actor, "asset", asset.id, "updated", diff)
    return await _public_asset(db, asset)


async def create_asset(db: AsyncSession, actor: dict, payload: dict[str, Any]) -> dict:
    """Create inventory row; asset_code is always system-generated (company prefix + asset_number_seq)."""
    supplied = [k for k in ("assetId", "assetCode", "assetTag") if k in payload]
    if supplied:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"{', '.join(supplied)} is system-generated and must not be supplied"
            ),
        )

    await seed_default_asset_categories(db)
    category_id = _parse_uuid(payload.get("categoryId"), "categoryId")
    cat = await db.execute(select(AssetCategory).where(AssetCategory.id == category_id))
    category = cat.scalar_one_or_none()
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="categoryId must reference an existing category",
        )

    condition = payload.get("condition")
    if condition is not None and str(condition).strip() != "":
        condition = str(condition).strip()
        if condition not in ASSET_CONDITIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"condition must be one of: {', '.join(sorted(ASSET_CONDITIONS))}",
            )
    else:
        condition = None
    try:
        os_platform = normalize_optional_os_platform(
            payload.get("osPlatform"), category.name
        )
        serial_number = normalize_optional_serial_number(
            payload.get("serialNumber"), category.name
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    purchase_date = _optional_date(payload.get("purchaseDate"), "purchaseDate")
    warranty_expiry = _optional_date(payload.get("warrantyExpiry"), "warrantyExpiry")
    try:
        warranty_plan_type = normalize_optional_warranty_plan_type(
            payload.get("warrantyPlanType")
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    warranty_plan_number = (
        _optional_text(payload.get("warrantyPlan")) if warranty_plan_type else None
    )
    if purchase_date and warranty_expiry and warranty_expiry < purchase_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="warrantyExpiry must be on or after purchaseDate",
        )
    if serial_number is not None:
        taken = await db.execute(select(Asset.id).where(Asset.serial_number == serial_number).limit(1))
        if taken.first() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="serialNumber already exists on another asset",
            )
    specs_raw = payload.get("specifications")
    if specs_raw is None:
        specs_raw = payload.get("ramStorage")
    model_raw = payload.get("model")

    asset_code = await _generate_asset_code(db, actor)
    if len(asset_code) > 40:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Generated assetCode exceeds maximum length",
        )
    row = Asset(
        asset_category_id=category_id,
        asset_code=asset_code,
        serial_number=serial_number,
        model=(str(model_raw).strip() or None) if model_raw is not None else None,
        os_platform=os_platform,
        specifications=(str(specs_raw).strip() or None) if specs_raw is not None else None,
        purchase_date=purchase_date,
        warranty_expiry=warranty_expiry,
        warranty_plan_type=warranty_plan_type,
        warranty_plan_number=warranty_plan_number,
        condition=condition,
        status=ASSET_STATUS_IN_STOCK,
    )
    db.add(row)
    await _flush(db)
    await _log(db, actor, "asset", row.id, "created", _snap(row, _ASSET_LOG_FIELDS))
    return asset_to_dict(row, category_name=category.name)


async def _require_asset(db: AsyncSession, system_asset_id: uuid.UUID) -> Asset:
    result = await db.execute(select(Asset).where(Asset.id == system_asset_id))
    asset = result.scalar_one_or_none()
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    return asset


async def _public_asset(db: AsyncSession, asset: Asset) -> dict:
    categories = await _category_map(db)
    cat = categories.get(asset.asset_category_id)
    open_by_asset = await _open_allocations_by_asset(db, [asset.id])
    open_alloc = open_by_asset.get(asset.id)
    emp = None
    if open_alloc is not None:
        employees = await _employees_by_id(db, [open_alloc.assigned_to_employee_id])
        emp = employees.get(open_alloc.assigned_to_employee_id)
    return asset_to_dict(
        asset,
        category_name=cat.name if cat else None,
        assigned_employee_id=(
            str(open_alloc.assigned_to_employee_id) if open_alloc else None
        ),
        assigned_employee_name=_employee_display_name(emp) if emp else None,
        open_allocation_id=str(open_alloc.id) if open_alloc else None,
    )


async def set_purchase_receipt(
    db: AsyncSession,
    actor: dict,
    system_asset_id: uuid.UUID,
    object_key: str,
    file_name: str,
) -> tuple[dict, str | None]:
    asset = await _require_asset(db, system_asset_id)
    previous = asset.purchase_receipt_object_key
    before = _snap(asset, _ASSET_LOG_FIELDS)
    asset.purchase_receipt_object_key = object_key
    asset.purchase_receipt_file_name = (file_name or "").strip() or "purchase-receipt"
    await _flush(db)
    diff = _diff(before, _snap(asset, _ASSET_LOG_FIELDS))
    if diff:
        await _log(db, actor, "asset", asset.id, "updated", diff)
    previous_to_remove = previous if previous and previous != object_key else None
    return await _public_asset(db, asset), previous_to_remove


async def clear_purchase_receipt(
    db: AsyncSession,
    actor: dict,
    system_asset_id: uuid.UUID,
) -> tuple[dict, str | None]:
    asset = await _require_asset(db, system_asset_id)
    previous = asset.purchase_receipt_object_key
    before = _snap(asset, _ASSET_LOG_FIELDS)
    asset.purchase_receipt_object_key = None
    asset.purchase_receipt_file_name = None
    await _flush(db)
    diff = _diff(before, _snap(asset, _ASSET_LOG_FIELDS))
    if diff:
        await _log(db, actor, "asset", asset.id, "updated", diff)
    return await _public_asset(db, asset), previous


async def purchase_receipt_object(
    db: AsyncSession, system_asset_id: uuid.UUID
) -> tuple[str, str]:
    asset = await _require_asset(db, system_asset_id)
    object_key = asset.purchase_receipt_object_key
    if not object_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No purchase receipt on this asset",
        )
    filename = (asset.purchase_receipt_file_name or "").strip() or "purchase-receipt"
    return object_key, filename


async def _require_open_allocation(
    db: AsyncSession, system_asset_id: uuid.UUID
) -> AssetAssignment | None:
    result = await db.execute(
        select(AssetAssignment).where(
            AssetAssignment.asset_id == system_asset_id,
            AssetAssignment.returned_date.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def _require_active_employee(db: AsyncSession, employee_id: uuid.UUID) -> Employee:
    emp_result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = emp_result.scalar_one_or_none()
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="employeeId must reference an existing employee",
        )
    if str(employee.status).upper() != Status.ACTIVE.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="employeeId must reference an Active employee",
        )
    return employee


def _parse_return_fields(
    payload: dict[str, Any],
    *,
    allocated_date: date,
    allowed_reasons: frozenset[str] = RETURN_REASONS,
) -> tuple[str, str | None, str, date, str | None]:
    reason = str(payload.get("reasonForReturn") or "").strip()
    # Legacy API alias applies only when Employee terminated is allowed (return, not swap).
    if reason == "Terminated" and "Employee terminated" in allowed_reasons:
        reason = "Employee terminated"
    if not reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="reasonForReturn is required",
        )
    if reason not in allowed_reasons:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"reasonForReturn must be one of: {', '.join(sorted(allowed_reasons))}",
        )
    reason_other = str(payload.get("reasonForReturnOther") or "").strip()
    if reason == "Other" and not reason_other:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="reasonForReturnOther is required when reasonForReturn is Other",
        )

    condition = str(payload.get("conditionAtReturn") or "").strip()
    if not condition:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="conditionAtReturn is required",
        )
    if condition not in ASSET_CONDITIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"conditionAtReturn must be one of: {', '.join(sorted(ASSET_CONDITIONS))}",
        )

    returned_date = (
        _parse_date(payload.get("returnedDate"), "returnedDate")
        if payload.get("returnedDate")
        else date.today()
    )
    if returned_date < allocated_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="returnedDate must be on or after allocatedDate",
        )

    return_notes = (
        str(payload.get("returnNotes")).strip()[:500]
        if payload.get("returnNotes") is not None
        else None
    ) or None
    return (
        reason,
        reason_other if reason == "Other" else None,
        condition,
        returned_date,
        return_notes,
    )


def _compose_return_note(reason: str, reason_other: str | None, notes: str | None) -> str | None:
    """asset_assignments.return_note: for Other it holds the required explanation (then any extra notes)."""
    if reason == "Other":
        note = reason_other or ""
        if notes:
            note = f"{note} — {notes}" if note else notes
        return note[:500] or None
    return (notes or "")[:500] or None


def _is_broken_return_reason(reason: str) -> bool:
    return str(reason or "").strip().lower() == "broken"


def outgoing_status_for_return_reason(reason: str) -> str:
    """Broken (any case) → Under Repair; every other return/swap reason → In Stock."""
    if _is_broken_return_reason(reason):
        return ASSET_STATUS_UNDER_REPAIR
    return ASSET_STATUS_IN_STOCK


async def _assert_asset_assignable(db: AsyncSession, asset: Asset) -> None:
    if (
        asset.status == ASSET_STATUS_UNDER_REPAIR
        or asset.status == ASSET_STATUS_DECOMMISSIONED
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot assign asset with status {asset.status}",
        )
    if asset.status != ASSET_STATUS_IN_STOCK:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Asset must be In Stock to assign",
        )
    open_alloc = await _require_open_allocation(db, asset.id)
    if open_alloc is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Asset already has an open assignment",
        )


async def _close_allocation_as_returned(
    db: AsyncSession,
    actor: dict,
    allocation: AssetAssignment,
    asset: Asset,
    *,
    reason: str,
    reason_other: str | None,
    condition: str,
    returned_date: date,
    return_notes: str | None,
    write_log: bool = True,
) -> None:
    """Close the assignment and move the asset to In Stock (or Under Repair when the reason is Broken)."""
    asset_before = _snap(asset, _ASSET_LOG_FIELDS)
    allocation.returned_date = returned_date
    allocation.condition_at_return = condition
    allocation.return_reason = reason
    allocation.return_note = _compose_return_note(reason, reason_other, return_notes)

    asset.status = outgoing_status_for_return_reason(reason)
    asset.condition = condition
    await _flush(db)

    if write_log:
        await _log(db, actor, "asset_assignment", allocation.id, "returned", _snap(allocation, _ASSIGNMENT_LOG_FIELDS))
    if _is_broken_return_reason(reason):
        await _log(db, actor, "asset", asset.id, "sent_for_repair", _diff(asset_before, _snap(asset, _ASSET_LOG_FIELDS)))


async def _open_allocation_for_employee(
    db: AsyncSession,
    actor: dict,
    asset: Asset,
    employee: Employee,
    *,
    allocated_date: date,
    replaces: AssetAssignment | None = None,
    write_log: bool = True,
) -> AssetAssignment:
    """Create the open assignment and set the asset to Assigned (one transaction)."""
    await _assert_asset_assignable(db, asset)

    allocation = AssetAssignment(
        asset_id=asset.id,
        assigned_to_employee_id=employee.id,
        assigned_date=allocated_date,
        replaces_assignment_id=replaces.id if replaces is not None else None,
    )
    asset.status = ASSET_STATUS_ASSIGNED
    db.add(allocation)
    await _flush(db)

    if write_log:
        await _log(
            db, actor, "asset_assignment", allocation.id,
            "swapped" if replaces is not None else "assigned",
            _snap(allocation, _ASSIGNMENT_LOG_FIELDS),
        )
    return allocation


async def allocate_asset(
    db: AsyncSession, actor: dict, system_asset_id: uuid.UUID, payload: dict[str, Any]
) -> dict:
    asset = await _require_asset(db, system_asset_id)
    employee_id = _parse_uuid(payload.get("employeeId"), "employeeId")
    employee = await _require_active_employee(db, employee_id)
    allocated_date = (
        _parse_date(payload.get("allocatedDate"), "allocatedDate")
        if payload.get("allocatedDate")
        else date.today()
    )

    allocation = await _open_allocation_for_employee(
        db, actor, asset, employee, allocated_date=allocated_date
    )

    categories = await _category_map(db)
    cat = categories.get(asset.asset_category_id)
    await _safe_notify(
        notify_asset_assigned(
            employee=employee,
            asset=asset,
            category=cat,
            allocated_date=allocated_date,
            assigned_by=_actor_name(actor),
        )
    )

    payload_out = allocation_to_dict(
        allocation,
        employee_name=_employee_display_name(employee),
        asset_id=asset.asset_code,
        category_name=cat.name if cat else None,
        model=asset.model,
        serial_number=asset.serial_number,
    )
    payload_out["asset"] = asset_to_dict(
        asset,
        category_name=cat.name if cat else None,
        assigned_employee_id=str(employee_id),
        assigned_employee_name=_employee_display_name(employee),
        open_allocation_id=str(allocation.id),
    )
    return payload_out


async def return_allocation(
    db: AsyncSession, actor: dict, allocation_id: uuid.UUID, payload: dict[str, Any]
) -> dict:
    result = await db.execute(
        select(AssetAssignment).where(AssetAssignment.id == allocation_id)
    )
    allocation = result.scalar_one_or_none()
    if allocation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Allocation not found"
        )
    if allocation.returned_date is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Allocation is already returned",
        )

    reason, reason_other, condition, returned_date, return_notes = _parse_return_fields(
        payload, allocated_date=allocation.assigned_date
    )
    asset = await _require_asset(db, allocation.asset_id)
    await _close_allocation_as_returned(
        db,
        actor,
        allocation,
        asset,
        reason=reason,
        reason_other=reason_other,
        condition=condition,
        returned_date=returned_date,
        return_notes=return_notes,
    )

    employee = (
        await db.execute(select(Employee).where(Employee.id == allocation.assigned_to_employee_id))
    ).scalar_one_or_none()
    categories = await _category_map(db)
    cat = categories.get(asset.asset_category_id)
    if employee is not None:
        await _safe_notify(
            notify_asset_returned(
                employee=employee,
                asset=asset,
                category=cat,
                reason=reason,
                reason_other=reason_other,
                condition_at_return=condition,
                returned_date=returned_date,
                returned_by=_actor_name(actor),
            )
        )
    out = allocation_to_dict(
        allocation,
        employee_name=_employee_display_name(employee) if employee else None,
        asset_id=asset.asset_code,
        category_name=cat.name if cat else None,
        model=asset.model,
        serial_number=asset.serial_number,
    )
    out["asset"] = asset_to_dict(asset, category_name=cat.name if cat else None)
    return out


async def swap_asset(
    db: AsyncSession, actor: dict, allocation_id: uuid.UUID, payload: dict[str, Any]
) -> dict:
    """Atomic return of current assignment + assign a different In Stock asset.

    The new assignment points at the one it replaces (replaces_assignment_id). Any failure rolls back the
    whole operation (one request = one transaction).
    """
    result = await db.execute(
        select(AssetAssignment).where(AssetAssignment.id == allocation_id)
    )
    old_allocation = result.scalar_one_or_none()
    if old_allocation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Allocation not found"
        )
    if old_allocation.returned_date is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Allocation is already returned",
        )

    new_system_asset_id = _parse_uuid(payload.get("systemAssetId"), "systemAssetId")
    if new_system_asset_id == old_allocation.asset_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="systemAssetId must be a different asset than the current allocation",
        )

    reason, reason_other, condition, returned_date, return_notes = _parse_return_fields(
        payload,
        allocated_date=old_allocation.assigned_date,
        allowed_reasons=SWAP_REASONS,
    )
    allocated_date = (
        _parse_date(payload.get("allocatedDate"), "allocatedDate")
        if payload.get("allocatedDate")
        else date.today()
    )
    if allocated_date < returned_date:
        # Same-day swap is normal; allocating before the return date is not.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="allocatedDate must be on or after returnedDate",
        )

    old_asset = await _require_asset(db, old_allocation.asset_id)
    new_asset = await _require_asset(db, new_system_asset_id)
    if old_asset.asset_category_id != new_asset.asset_category_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Replacement must be the same category as the current asset",
        )
    await _assert_asset_assignable(db, new_asset)
    employee = await _require_active_employee(db, old_allocation.assigned_to_employee_id)

    await _close_allocation_as_returned(
        db,
        actor,
        old_allocation,
        old_asset,
        reason=reason,
        reason_other=reason_other,
        condition=condition,
        returned_date=returned_date,
        return_notes=return_notes,
    )

    new_allocation = await _open_allocation_for_employee(
        db,
        actor,
        new_asset,
        employee,
        allocated_date=allocated_date,
        replaces=old_allocation,
    )

    categories = await _category_map(db)
    old_cat = categories.get(old_asset.asset_category_id)
    new_cat = categories.get(new_asset.asset_category_id)

    # One email for the whole swap, not a return notice plus an assignment notice.
    await _safe_notify(
        notify_asset_swapped(
            employee=employee,
            old_asset=old_asset,
            old_category=old_cat,
            new_asset=new_asset,
            new_category=new_cat,
            reason=reason,
            reason_other=reason_other,
            condition_at_return=condition,
            swapped_on=allocated_date,
            processed_by=_actor_name(actor),
        )
    )

    returned_out = allocation_to_dict(
        old_allocation,
        employee_name=_employee_display_name(employee),
        asset_id=old_asset.asset_code,
        category_name=old_cat.name if old_cat else None,
        model=old_asset.model,
        serial_number=old_asset.serial_number,
    )
    returned_out["swappedWithAllocationId"] = str(new_allocation.id)
    returned_out["asset"] = asset_to_dict(
        old_asset, category_name=old_cat.name if old_cat else None
    )

    allocated_out = allocation_to_dict(
        new_allocation,
        employee_name=_employee_display_name(employee),
        asset_id=new_asset.asset_code,
        category_name=new_cat.name if new_cat else None,
        model=new_asset.model,
        serial_number=new_asset.serial_number,
    )
    allocated_out["asset"] = asset_to_dict(
        new_asset,
        category_name=new_cat.name if new_cat else None,
        assigned_employee_id=str(employee.id),
        assigned_employee_name=_employee_display_name(employee),
        open_allocation_id=str(new_allocation.id),
    )

    return {
        "returned": returned_out,
        "allocated": allocated_out,
        "swapped": True,
    }


async def list_employee_assets(
    db: AsyncSession,
    employee_id: uuid.UUID,
    *,
    include_history: bool = False,
) -> list[dict]:
    stmt = (
        select(AssetAssignment, Asset, AssetCategory)
        .join(Asset, Asset.id == AssetAssignment.asset_id)
        .join(AssetCategory, AssetCategory.id == Asset.asset_category_id)
        .where(AssetAssignment.assigned_to_employee_id == employee_id)
        .order_by(AssetAssignment.assigned_date.desc())
    )
    if not include_history:
        stmt = stmt.where(AssetAssignment.returned_date.is_(None))
    result = await db.execute(stmt)
    rows = result.all()
    out: list[dict] = []
    for allocation, asset, category in rows:
        out.append(
            allocation_to_dict(
                allocation,
                asset_id=asset.asset_code,
                category_name=category.name,
                model=asset.model,
                serial_number=asset.serial_number,
            )
        )
    return out


def _activity_notes(action: str, details: dict[str, Any] | None, asset_code: str, names: dict[str, str]) -> str | None:
    d = details or {}
    if action == "created":
        return f"Created asset {asset_code}"
    if action in {"assigned", "swapped"}:
        who = names.get(str(d.get("assigned_to_employee_id")), "employee")
        return f"Assigned to {who}" + ("; swap replacement" if action == "swapped" else "")
    if action == "returned":
        return f"Returned ({d.get('return_reason')})" if d.get("return_reason") else "Returned"
    if action == "sent_for_repair":
        return "Under Repair"
    if action == "marked_lost":
        return d.get("note") if isinstance(d.get("note"), str) else None
    return None


async def list_asset_activity(db: AsyncSession, system_asset_id: uuid.UUID) -> list[dict]:
    asset = await _require_asset(db, system_asset_id)
    rows = (
        await db.execute(
            select(ActivityLog)
            .where(
                or_(
                    (ActivityLog.entity_type == "asset") & (ActivityLog.entity_id == system_asset_id),
                    (ActivityLog.entity_type == "asset_assignment")
                    & (ActivityLog.details["asset_id"].astext == str(system_asset_id)),
                )
            )
            .order_by(ActivityLog.occurred_at.asc(), ActivityLog.id.asc())
        )
    ).scalars().all()
    employee_ids: set[uuid.UUID] = set()
    for row in rows:
        raw = (row.details or {}).get("assigned_to_employee_id")
        try:
            if raw:
                employee_ids.add(uuid.UUID(str(raw)))
        except ValueError:
            pass
    names = {
        str(eid): _employee_display_name(emp) for eid, emp in (await _employees_by_id(db, list(employee_ids))).items()
    }
    return [
        {
            "logId": str(row.id),
            "systemAssetId": str(system_asset_id),
            "actionType": _ACTIVITY_LABELS.get(row.action, row.action),
            "performedBy": str(row.actor_employee_id) if row.actor_employee_id else None,
            "actionDate": row.occurred_at.isoformat() if row.occurred_at else None,
            "notes": _activity_notes(row.action, row.details, asset.asset_code, names),
        }
        for row in rows
    ]


_DECOMMISSION_ALLOWED = frozenset(
    {ASSET_STATUS_IN_STOCK, ASSET_STATUS_UNDER_REPAIR}
)


async def _transition(
    db: AsyncSession, actor: dict, asset: Asset, new_status: str, action: str, *, condition: str | None = None
) -> dict:
    before = _snap(asset, _ASSET_LOG_FIELDS)
    asset.status = new_status
    if condition is not None:
        asset.condition = condition
    await _flush(db)
    await _log(db, actor, "asset", asset.id, action, _diff(before, _snap(asset, _ASSET_LOG_FIELDS)))
    return await _public_asset(db, asset)


async def retire_asset(db: AsyncSession, actor: dict, system_asset_id: uuid.UUID) -> dict:
    asset = await _require_asset(db, system_asset_id)
    if asset.status == ASSET_STATUS_ASSIGNED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Asset must be returned before it can be decommissioned",
        )
    if asset.status not in _DECOMMISSION_ALLOWED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot decommission asset with status {asset.status}",
        )
    return await _transition(db, actor, asset, ASSET_STATUS_DECOMMISSIONED, "decommissioned")


_RETURN_TO_STOCK_ALLOWED = frozenset(
    {ASSET_STATUS_DECOMMISSIONED, ASSET_STATUS_UNDER_REPAIR}
)


def assert_return_to_stock_allowed(asset: Any) -> None:
    if asset.status not in _RETURN_TO_STOCK_ALLOWED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Only Under Repair or Decommissioned assets can be returned to stock "
                f"(current status: {asset.status})"
            ),
        )


async def return_asset_to_stock(
    db: AsyncSession, actor: dict, system_asset_id: uuid.UUID
) -> dict:
    asset = await _require_asset(db, system_asset_id)
    assert_return_to_stock_allowed(asset)
    return await _transition(db, actor, asset, ASSET_STATUS_IN_STOCK, "reactivated")


_REPORT_LOST_ALLOWED = frozenset(
    {ASSET_STATUS_IN_STOCK, ASSET_STATUS_ASSIGNED, ASSET_STATUS_UNDER_REPAIR}
)


async def _last_holder(db: AsyncSession, system_asset_id: uuid.UUID) -> Employee | None:
    """Whoever held the asset most recently (the current holder, if assigned)."""
    row = (
        await db.execute(
            select(Employee)
            .join(AssetAssignment, AssetAssignment.assigned_to_employee_id == Employee.id)
            .where(AssetAssignment.asset_id == system_asset_id)
            .order_by(
                AssetAssignment.assigned_date.desc(),
                AssetAssignment.returned_date.desc().nulls_first(),
            )
            .limit(1)
        )
    ).scalar_one_or_none()
    return row


async def report_lost(
    db: AsyncSession, actor: dict, system_asset_id: uuid.UUID, payload: dict[str, Any]
) -> dict:
    """Record an asset as lost or stolen: close any open assignment and set Lost."""
    asset = await _require_asset(db, system_asset_id)
    if asset.status not in _REPORT_LOST_ALLOWED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot report an asset with status {asset.status} as lost",
        )
    reason = str(payload.get("reason") or "Lost").strip().capitalize()
    if reason not in LOST_REASONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"reason must be one of: {', '.join(sorted(LOST_REASONS))}",
        )
    notes = _optional_text(payload.get("notes"))
    if notes is not None and len(notes) > 255:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="notes must be 255 characters or fewer",
        )
    today = date.today()
    lost_date = _optional_date(payload.get("lostDate"), "lostDate") or today
    if lost_date > today:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="lostDate cannot be in the future",
        )

    holder: Employee | None = None
    allocation = await _require_open_allocation(db, system_asset_id)
    if allocation is not None:
        if lost_date < allocation.assigned_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="lostDate cannot be before the asset was assigned",
            )
        # Lost / Stolen is the one return with no condition (ck_asset_assignments_condition_needed).
        allocation.returned_date = lost_date
        allocation.return_reason = reason
        allocation.condition_at_return = None
        allocation.return_note = notes
        holder = (
            await db.execute(
                select(Employee).where(Employee.id == allocation.assigned_to_employee_id)
            )
        ).scalar_one_or_none()
    before = _snap(asset, _ASSET_LOG_FIELDS)
    asset.status = ASSET_STATUS_LOST
    await _flush(db)
    if allocation is not None:
        await _log(db, actor, "asset_assignment", allocation.id, "returned", _snap(allocation, _ASSIGNMENT_LOG_FIELDS))
    await _log(db, actor, "asset", asset.id, "marked_lost", _diff(before, _snap(asset, _ASSET_LOG_FIELDS)))

    categories = await _category_map(db)
    cat = categories.get(asset.asset_category_id)
    await _safe_notify(
        notify_asset_lost_or_found(
            kind="lost",
            asset=asset,
            category=cat,
            employee=holder,
            detail=f"{reason} on {lost_date.isoformat()}",
            notes=notes,
            recorded_by=_actor_name(actor),
        )
    )
    return asset_to_dict(asset, category_name=cat.name if cat else None)


async def mark_found(
    db: AsyncSession, actor: dict, system_asset_id: uuid.UUID, payload: dict[str, Any]
) -> dict:
    """A lost asset turned up: its condition decides the next status."""
    asset = await _require_asset(db, system_asset_id)
    if asset.status != ASSET_STATUS_LOST:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only a Lost asset can be marked found (current status: {asset.status})",
        )
    condition = str(payload.get("condition") or "").strip()
    if condition not in FOUND_CONDITIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"condition must be one of: {', '.join(FOUND_CONDITIONS)}",
        )
    notes = _optional_text(payload.get("notes"))
    if notes is not None and len(notes) > 255:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="notes must be 255 characters or fewer",
        )
    new_status, stored_condition = FOUND_CONDITIONS[condition]
    out = await _transition(db, actor, asset, new_status, "marked_found", condition=stored_condition)
    categories = await _category_map(db)
    cat = categories.get(asset.asset_category_id)
    await _safe_notify(
        notify_asset_lost_or_found(
            kind="found",
            asset=asset,
            category=cat,
            employee=await _last_holder(db, system_asset_id),
            detail=f"Found in {condition.lower()} condition. Status is now {new_status}.",
            notes=notes,
            recorded_by=_actor_name(actor),
        )
    )
    return out


async def list_categories_with_stock(db: AsyncSession) -> list[dict]:
    """Category catalog plus how many assets of each are In Stock (request forms)."""
    await seed_default_asset_categories(db)
    counts = dict(
        (
            await db.execute(
                select(Asset.asset_category_id, func.count())
                .where(Asset.status == ASSET_STATUS_IN_STOCK)
                .group_by(Asset.asset_category_id)
            )
        ).all()
    )
    rows = (
        await db.execute(select(AssetCategory).order_by(AssetCategory.name))
    ).scalars().all()
    return [
        {**category_to_dict(row), "inStockCount": int(counts.get(row.id, 0))}
        for row in rows
    ]


async def list_in_stock_assets(
    db: AsyncSession, category_id: uuid.UUID
) -> list[dict]:
    """In Stock assets of one category, for picking what to hand out."""
    rows = (
        await db.execute(
            select(Asset)
            .where(
                Asset.asset_category_id == category_id,
                Asset.status == ASSET_STATUS_IN_STOCK,
            )
            .order_by(Asset.asset_code)
        )
    ).scalars().all()
    return [
        {
            "systemAssetId": str(row.id),
            "assetId": row.asset_code,
            "model": row.model,
            "serialNumber": row.serial_number,
            "osPlatform": row.os_platform,
            "specifications": row.specifications,
            "condition": row.condition,
        }
        for row in rows
    ]
