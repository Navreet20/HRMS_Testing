"""Deciding Employee Portal requests: saving the decision and carrying it out.

Approving an asset request does the work in Assets (assign, swap or record the
loss). Approving a profile change applies it to the employee. Every decision
keeps the manager's comment, who decided and when.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.tables import (Asset, AssetAllocation, Employee)
from app.models.awaiting import EmployeeFieldAudit
from app.models.tables import AssetRequest, ProfileUpdateRequest
from app.modules.assets import service as assets_service
from app.modules.workflow.events import (
    EVENT_APPROVED,
    EVENT_REJECTED,
    EVENT_RESUBMITTED,
    EVENT_SUBMITTED,
    record_event,
)
from app.modules.assets.constants import ASSET_STATUS_IN_STOCK
from app.modules.rbac.access import (
    MODULE_KEY_ASSETS,
    level_meets_minimum,
    resolve_module_access_level,
)
from app.modules.rbac.grants import ACCESS_LEVEL_FULL_ACCESS
from app.core.bootstrap_admin import is_superadmin_view

REQUEST_TYPE_LABELS = {
    "new": "New asset",
    "swap": "Swap",
    "reportLostStolen": "Report lost or stolen",
}

_PROFILE_ATTR = {
    "firstName": "first_name",
    "lastName": "last_name",
    "dateOfBirth": "date_of_birth",
    "nationality": "nationality",
}


def actor_display_name(user: dict[str, Any]) -> str:
    name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
    return name or str(user.get("email") or user.get("emailId") or "").strip()


def actor_uuid(user: dict[str, Any]) -> uuid.UUID | None:
    try:
        return uuid.UUID(str(user.get("employeeId") or user.get("id")))
    except (TypeError, ValueError):
        return None


def record_decision(row: Any, user: dict[str, Any], note: str | None) -> None:
    """Stamp a request with the decision comment, who decided and when."""
    row.decision_note = (note or "").strip()[:255] or None
    row.decided_by_employee_id = actor_uuid(user)
    row.decided_by_name = actor_display_name(user)[:200] or None
    row.decided_date = datetime.now(timezone.utc)


def log_decision(
    session: AsyncSession,
    item_type: str,
    row: Any,
    user: dict[str, Any],
    *,
    approved: bool,
    note: str | None,
) -> None:
    """Timeline entry for an approval or a rejection (with its comment)."""
    record_event(
        session,
        item_type=item_type,
        item_id=row.id,
        event=EVENT_APPROVED if approved else EVENT_REJECTED,
        user=user,
        comment=note,
    )


async def log_submission(
    session: AsyncSession,
    item_type: str,
    model: Any,
    row: Any,
    user: dict[str, Any],
    resubmit_of_raw: Any,
) -> None:
    """Timeline entry for a new request; links it to the rejected one it replaces.

    Requests have no recall stage, so a rejected one is resubmitted as a new,
    prefilled request. The link keeps the whole story together.
    """
    if resubmit_of_raw in (None, ""):
        record_event(session, item_type=item_type, item_id=row.id, event=EVENT_SUBMITTED, user=user)
        return
    try:
        old_id = uuid.UUID(str(resubmit_of_raw))
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="resubmitOfId must be a valid id"
        ) from None
    old = (
        await session.execute(select(model).where(model.id == old_id))
    ).scalar_one_or_none()
    actor = actor_uuid(user)
    mine = old is not None and actor in (old.employee_id, old.submitted_by_employee_id)
    if old is None or not mine or (old.status or "").strip().lower() != "rejected":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only your own rejected request can be resubmitted",
        )
    record_event(
        session,
        item_type=item_type,
        item_id=row.id,
        event=EVENT_RESUBMITTED,
        user=user,
        comment=f"Resubmitted after the rejection of request {old_id}",
    )
    record_event(
        session,
        item_type=item_type,
        item_id=old_id,
        event=EVENT_RESUBMITTED,
        user=user,
        comment=f"Resubmitted as request {row.id}",
    )


async def require_assets_full_access(session: AsyncSession, user: dict[str, Any]) -> None:
    """Approving an asset request changes inventory, so it needs Assets full access."""
    if get_settings().auth_bypass or is_superadmin_view(user):
        return
    employee_id = actor_uuid(user)
    if employee_id is not None:
        level = await resolve_module_access_level(
            session, employee_id=employee_id, module_key=MODULE_KEY_ASSETS
        )
        if level_meets_minimum(level, ACCESS_LEVEL_FULL_ACCESS):
            return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You need Assets full access to approve asset requests",
    )


def _parse_asset_id(body: dict[str, Any]) -> uuid.UUID:
    raw = body.get("assignSystemAssetId")
    try:
        return uuid.UUID(str(raw))
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Choose the asset to hand out (assignSystemAssetId)",
        ) from None


async def _open_allocation(
    session: AsyncSession, employee_id: uuid.UUID, system_asset_id: uuid.UUID
) -> AssetAllocation:
    allocation = (
        await session.execute(
            select(AssetAllocation).where(
                AssetAllocation.employee_id == employee_id,
                AssetAllocation.system_asset_id == system_asset_id,
                AssetAllocation.returned_date.is_(None),
            )
        )
    ).scalar_one_or_none()
    if allocation is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That asset is no longer assigned to this employee",
        )
    return allocation


async def _category_of(session: AsyncSession, system_asset_id: uuid.UUID) -> uuid.UUID | None:
    return (
        await session.execute(
            select(Asset.category_id).where(Asset.system_asset_id == system_asset_id)
        )
    ).scalar_one_or_none()


async def _asset_code(session: AsyncSession, system_asset_id: uuid.UUID) -> str:
    return (
        await session.execute(
            select(Asset.asset_id).where(Asset.system_asset_id == system_asset_id)
        )
    ).scalar_one_or_none() or "asset"


async def in_stock_count(session: AsyncSession, category_id: uuid.UUID) -> int:
    return int(
        (
            await session.execute(
                select(func.count())
                .select_from(Asset)
                .where(
                    Asset.category_id == category_id,
                    Asset.status == ASSET_STATUS_IN_STOCK,
                )
            )
        ).scalar_one()
    )


async def available_assets_for_request(
    session: AsyncSession, request: AssetRequest
) -> list[dict]:
    """In Stock assets that could fulfil this request (none for a lost report)."""
    if request.request_type == "new":
        category_id = request.requested_category_id
    elif request.request_type == "swap" and request.system_asset_id is not None:
        category_id = await _category_of(session, request.system_asset_id)
    else:
        return []
    if category_id is None:
        return []
    return await assets_service.list_in_stock_assets(session, category_id)


async def fulfil_asset_request(
    session: AsyncSession,
    user: dict[str, Any],
    request: AssetRequest,
    body: dict[str, Any],
) -> str:
    """Do the Assets work for an approved request. Returns a one-line outcome."""
    await require_assets_full_access(session, user)
    employee_id = request.employee_id

    if request.request_type == "new":
        new_id = _parse_asset_id(body)
        if await _category_of(session, new_id) != request.requested_category_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="That asset is not in the category that was requested",
            )
        await assets_service.allocate_asset(
            session, user, new_id, {"employeeId": str(employee_id)}
        )
        request.fulfilled_system_asset_id = new_id
        return f"Asset {await _asset_code(session, new_id)} assigned"

    if request.request_type == "swap":
        if request.system_asset_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This swap request has no asset to swap",
            )
        new_id = _parse_asset_id(body)
        if await _category_of(session, new_id) != await _category_of(
            session, request.system_asset_id
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The replacement must be in the same category",
            )
        allocation = await _open_allocation(session, employee_id, request.system_asset_id)
        await assets_service.swap_asset(
            session,
            user,
            allocation.allocation_id,
            {
                "systemAssetId": str(new_id),
                "reasonForReturn": body.get("reasonForReturn"),
                "reasonForReturnOther": body.get("reasonForReturnOther"),
                "conditionAtReturn": body.get("conditionAtReturn"),
                "returnNotes": body.get("returnNotes"),
            },
        )
        request.fulfilled_system_asset_id = new_id
        old_code = await _asset_code(session, request.system_asset_id)
        return (
            f"Asset {old_code} swapped for {await _asset_code(session, new_id)}"
        )

    if request.request_type == "reportLostStolen":
        if request.system_asset_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This request has no asset to report",
            )
        await _open_allocation(session, employee_id, request.system_asset_id)
        await assets_service.report_lost(
            session,
            user,
            request.system_asset_id,
            {
                "reason": body.get("reason") or "Lost",
                "notes": (request.new_asset_details or "")[:255],
            },
        )
        return f"Asset {await _asset_code(session, request.system_asset_id)} recorded as lost"

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown asset request type"
    )


async def apply_profile_change(
    session: AsyncSession, user: dict[str, Any], request: ProfileUpdateRequest
) -> bool:
    """Write an approved single-field change to the employee. Returns True if applied.

    Free-text requests ("general") have nothing to apply. A value that already
    matches (someone edited the profile by hand first) is left alone.
    """
    attr = _PROFILE_ATTR.get(request.field_changed)
    if attr is None:
        return False
    employee = (
        await session.execute(
            select(Employee).where(Employee.employee_id == request.employee_id)
        )
    ).scalar_one_or_none()
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")

    current = getattr(employee, attr, None)
    current_text = current.isoformat() if isinstance(current, date) else (
        str(current).strip() if current is not None else None
    )
    if current_text == request.new_value:
        return False

    value: Any = request.new_value
    if request.field_changed == "dateOfBirth":
        try:
            value = date.fromisoformat(request.new_value)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The requested date of birth is not a valid date",
            ) from None
    setattr(employee, attr, value)
    now = datetime.now(timezone.utc)
    employee.updated_date = now
    employee.updated_by = actor_display_name(user) or employee.updated_by

    session.add(
        EmployeeFieldAudit(
            employee_id=employee.employee_id,
            employee_name=f"{employee.first_name or ''} {employee.last_name or ''}".strip()
            or None,
            employee_code=(employee.employee_code or "").strip() or None,
            business_employee_id=(employee.business_employee_id or "").strip() or None,
            field_name=request.field_changed,
            old_value=current_text,
            new_value=request.new_value,
            changed_by=actor_display_name(user) or None,
            changed_by_id=str(actor_uuid(user)) if actor_uuid(user) else None,
            changed_by_role="HR",
            reason=f"Profile update request {request.id} approved",
            changed_at=now,
        )
    )
    return True
