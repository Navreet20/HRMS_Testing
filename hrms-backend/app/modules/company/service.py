from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.role_groups import ADMIN_ROLES, TIMESHEET_ORG_APPROVER_ROLES
from app.core.serialize import company_to_dict
from app.models.tables import Company, Employee, Location
from app.modules.company.constants import (
    COMPANY_TYPE_INVALID_MESSAGE,
    COMPANY_TYPE_SET,
)
from app.modules.company.website import normalize_company_website

MULTI_COMPANY_NOT_SUPPORTED = (
    "Multi-company operations are not supported on this single-company platform. "
    "Use GET /companies/current or GET/PATCH /companies/{company_id}."
)

_CONFIG_KEYS = frozenset(
    {"timesheetReminderWeekday", "timesheetExpectedWeeklyHours", "timesheetHoursFormat"}
)
_STAFF_ROLES = {role.value for role in TIMESHEET_ORG_APPROVER_ROLES}
_ADMIN_ROLES = {role.value for role in ADMIN_ROLES}

_PROFILE_FIELD_MAP = {
    "company_name": "companyName",
    "company_type": "companyType",
    "company_email": "companyEmail",
    "company_phone": "companyPhone",
    "company_website": "companyWebsite",
    "company_address_line1": "companyAddressLine1",
    "company_address_line2": "companyAddressLine2",
    "city": "city",
    "state": "state",
    "zipcode": "zipcode",
    "country": "country",
}

_ADDRESS_KEYS = frozenset(
    {
        "companyAddressLine1",
        "companyAddressLine2",
        "city",
        "state",
        "zipcode",
        "country",
    }
)


def reject_multi_company() -> None:
    """Keep legacy multi-company routes registered but closed."""
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail=MULTI_COMPANY_NOT_SUPPORTED,
    )


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _actor_name(actor: dict[str, Any]) -> str:
    return f"{actor.get('firstName', '')} {actor.get('lastName', '')}".strip()


def _actor_company_id(actor: dict[str, Any]) -> uuid.UUID | None:
    raw = actor.get("company")
    if not isinstance(raw, dict):
        return None
    company_id = raw.get("companyId")
    if company_id is None or str(company_id).strip() == "":
        return None
    try:
        return uuid.UUID(str(company_id))
    except ValueError:
        return None


async def _load_company(db: AsyncSession, company_id: uuid.UUID) -> Company:
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if company is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    return company


async def sync_employee_company_name(
    db: AsyncSession,
    old_name: str,
    new_name: str,
) -> None:
    """Keep EMPLOYEE.COMPANY aligned with COMPANIES.COMPANY_NAME for login matching."""
    previous = old_name.strip()
    next_name = new_name.strip()
    if not previous or previous == next_name:
        return
    await db.execute(
        update(Employee)
        .where(func.lower(Employee.company) == previous.lower())
        .values(company=next_name)
    )


async def get_current_company(db: AsyncSession, actor: dict[str, Any]) -> dict:
    """Return the single company profile for this deployment."""
    actor_company = _actor_company_id(actor)
    if actor_company is not None:
        result = await db.execute(select(Company).where(Company.id == actor_company))
        company = result.scalar_one_or_none()
        if company is not None:
            return company_to_dict(company)
    result = await db.execute(select(Company).order_by(Company.company_name).limit(1))
    company = result.scalar_one_or_none()
    if company is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    return company_to_dict(company)


async def get_company(db: AsyncSession, company_id: uuid.UUID) -> dict:
    company = await _load_company(db, company_id)
    return company_to_dict(company)


def _actor_role(actor: dict[str, Any]) -> str:
    return str(actor.get("role") or "").strip().upper()


def _normalize_reminder_weekday(value: Any) -> int:
    try:
        weekday = int(value)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Timesheet reminder day must be a weekday.",
        ) from exc
    if weekday < 0 or weekday > 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Timesheet reminder day must be Monday through Sunday.",
        )
    return weekday


TIMESHEET_HOURS_FORMATS = ("clock", "decimal")


def _normalize_hours_format(value: Any) -> str:
    text = str(value or "").strip().lower()
    if text not in TIMESHEET_HOURS_FORMATS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Timesheet hours format must be 'clock' or 'decimal'.",
        )
    return text


def _normalize_expected_hours(value: Any) -> float:
    try:
        hours = float(value)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Expected weekly hours must be a number.",
        ) from exc
    if hours < 1 or hours > 168:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Expected weekly hours must be between 1 and 168.",
        )
    return round(hours, 2)


def _normalize_company_type(value: Any) -> str:
    company_type = str(value or "").strip()
    if not company_type:
        return ""
    if company_type not in COMPANY_TYPE_SET:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=COMPANY_TYPE_INVALID_MESSAGE,
        )
    return company_type


def asset_code_prefix_from_name(company_name: str) -> str:
    """``Cognivance`` → ``COG``; letters only, up to 3 chars (fallback ``AST``)."""
    letters = re.sub(r"[^A-Za-z]", "", company_name or "")
    prefix = letters[:3].upper()
    return prefix or "AST"


def _resolve_asset_code_prefix(payload: dict[str, Any], *, company_name: str) -> str:
    raw = payload.get("assetCodePrefix")
    if raw is not None and str(raw).strip():
        return str(raw).strip().upper()[:10]
    return asset_code_prefix_from_name(company_name)


def _copy_location_address(company: Company, location: Location) -> None:
    company.company_address_line1 = (location.address_line_1 or "").strip() or "—"
    company.company_address_line2 = location.address_line_2
    company.city = (location.city or "").strip() or "—"
    company.state = (location.state or "").strip() or "—"
    company.zipcode = (location.zip or "").strip() or "—"
    company.country = (location.country or "").strip() or "—"


async def _apply_headquarters(
    db: AsyncSession,
    company: Company,
    raw_location_id: Any,
) -> None:
    if raw_location_id is None or str(raw_location_id).strip() == "":
        company.headquarters_location_id = None
        return
    try:
        location_id = uuid.UUID(str(raw_location_id).strip())
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Select a headquarters from Locations.",
        ) from exc
    result = await db.execute(
        select(Location).where(
            Location.location_id == location_id,
            Location.company_id == company.id,
        )
    )
    location = result.scalar_one_or_none()
    if location is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Headquarters must be one of this company's locations.",
        )
    status_value = str(location.status or "").strip().lower()
    if status_value != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Headquarters must be an active location.",
        )
    company.headquarters_location_id = location.location_id
    _copy_location_address(company, location)


async def update_company(
    db: AsyncSession,
    actor: dict[str, Any],
    company_id: uuid.UUID,
    payload: dict[str, Any],
) -> dict:
    role = _actor_role(actor)
    if role not in _STAFF_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    keys = {key for key in payload.keys() if payload.get(key) is not None}
    if role not in _ADMIN_ROLES:
        extra = keys - _CONFIG_KEYS
        if extra or not keys:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your role can only update Configuration.",
            )

    company = await _load_company(db, company_id)
    old_name = company.company_name or ""
    if "companyName" in payload:
        requested_name = str(payload.get("companyName") or "").strip()
        if not requested_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Company name is required.",
            )
        payload = {**payload, "companyName": requested_name}
    if "companyType" in payload and payload["companyType"] is not None:
        payload = {
            **payload,
            "companyType": _normalize_company_type(payload["companyType"]),
        }
    if "companyWebsite" in payload and payload["companyWebsite"] is not None:
        try:
            payload = {
                **payload,
                "companyWebsite": normalize_company_website(
                    str(payload["companyWebsite"])
                ),
            }
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc
    payload = {key: value for key, value in payload.items() if key != "companyLogo"}
    for attr, key in _PROFILE_FIELD_MAP.items():
        if key in _ADDRESS_KEYS:
            continue
        if key in payload and payload[key] is not None:
            setattr(company, attr, payload[key])
    if "headquartersLocationId" in payload:
        await _apply_headquarters(db, company, payload.get("headquartersLocationId"))
    if "timesheetReminderWeekday" in payload:
        company.timesheet_reminder_weekday = _normalize_reminder_weekday(
            payload["timesheetReminderWeekday"],
        )
    if "timesheetExpectedWeeklyHours" in payload:
        company.timesheet_expected_weekly_hours = _normalize_expected_hours(
            payload["timesheetExpectedWeeklyHours"],
        )
    if "timesheetHoursFormat" in payload:
        company.timesheet_hours_format = _normalize_hours_format(
            payload["timesheetHoursFormat"],
        )
    if "assetCodePrefix" in payload and payload.get("assetCodePrefix") is not None:
        company.asset_code_prefix = _resolve_asset_code_prefix(
            payload, company_name=company.company_name or ""
        )
    new_name = (company.company_name or "").strip()
    # Keep asset codes aligned with the company name unless a custom prefix was sent.
    if "companyName" in payload and "assetCodePrefix" not in payload:
        company.asset_code_prefix = asset_code_prefix_from_name(new_name)
    await sync_employee_company_name(db, old_name, new_name)
    actor_name = _actor_name(actor)
    if actor_name:
        company.updated_by = actor_name
    company.updated_date = _now()
    await db.flush()
    return company_to_dict(company)


async def _resolve_current_company(db: AsyncSession, actor: dict[str, Any]) -> Company:
    actor_company = _actor_company_id(actor)
    if actor_company is not None:
        result = await db.execute(select(Company).where(Company.id == actor_company))
        company = result.scalar_one_or_none()
        if company is not None:
            return company
    result = await db.execute(select(Company).order_by(Company.company_name).limit(1))
    company = result.scalar_one_or_none()
    if company is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    return company


async def set_logo(
    db: AsyncSession,
    actor: dict[str, Any],
    company_id: uuid.UUID,
    object_key: str,
) -> dict:
    role = _actor_role(actor)
    if role not in _ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    company = await _load_company(db, company_id)
    previous = company.logo_object_key
    company.logo_object_key = object_key
    await db.flush()
    return {
        "companyId": str(company.id),
        "logoObjectKey": object_key,
        "previousObjectKey": previous,
    }


async def clear_logo(
    db: AsyncSession,
    actor: dict[str, Any],
    company_id: uuid.UUID,
) -> dict:
    role = _actor_role(actor)
    if role not in _ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    company = await _load_company(db, company_id)
    previous = company.logo_object_key
    company.logo_object_key = None
    await db.flush()
    return {
        "companyId": str(company.id),
        "logoObjectKey": None,
        "previousObjectKey": previous,
    }


async def get_logo_key(db: AsyncSession, company_id: uuid.UUID) -> str:
    company = await _load_company(db, company_id)
    key = company.logo_object_key
    if not key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company has no logo",
        )
    return key


async def get_current_logo_key(db: AsyncSession, actor: dict[str, Any]) -> str:
    company = await _resolve_current_company(db, actor)
    key = company.logo_object_key
    if not key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company has no logo",
        )
    return key


async def list_companies(_db: AsyncSession) -> list[dict]:
    reject_multi_company()
    return []


async def create_company(
    db: AsyncSession, actor: dict[str, Any], payload: dict[str, Any]
) -> dict:
    """Create the single company row when the workspace has none yet.

    A second company is still rejected (single-company platform).
    """
    existing = (
        await db.execute(select(func.count()).select_from(Company))
    ).scalar_one()
    if int(existing or 0) > 0:
        reject_multi_company()

    role = _actor_role(actor)
    if role not in _ADMIN_ROLES and not actor.get("superadminView"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    name = str(payload.get("companyName") or "").strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company name is required.",
        )
    company_type = _normalize_company_type(payload.get("companyType"))
    if not company_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=COMPANY_TYPE_INVALID_MESSAGE,
        )

    email = str(payload.get("companyEmail") or "").strip() or None
    phone = str(payload.get("companyPhone") or "").strip() or None
    website_raw = payload.get("companyWebsite")
    website: str | None = None
    if website_raw is not None and str(website_raw).strip():
        try:
            website = normalize_company_website(str(website_raw))
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

    location_id: uuid.UUID | None = None
    raw_location = payload.get("headquartersLocationId")
    if raw_location is not None and str(raw_location).strip():
        try:
            location_id = uuid.UUID(str(raw_location).strip())
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Select a headquarters from Locations.",
            ) from exc
        location = (
            await db.execute(select(Location).where(Location.id == location_id))
        ).scalar_one_or_none()
        if location is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Headquarters must be an existing location.",
            )
        if getattr(location, "is_active", True) is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Headquarters must be an active location.",
            )

    prefix = _resolve_asset_code_prefix(payload, company_name=name)
    company = Company(
        id=uuid.uuid4(),
        name=name,
        company_type=company_type,
        email=email,
        phone=phone,
        website=website,
        location_id=location_id,
        asset_code_prefix=prefix,
    )
    db.add(company)
    await db.flush()
    return company_to_dict(company)


async def approve_company(_db: AsyncSession, _company_id: uuid.UUID) -> dict:
    reject_multi_company()
    raise AssertionError("unreachable")


async def reject_company(_db: AsyncSession, _company_id: uuid.UUID) -> dict:
    reject_multi_company()
    raise AssertionError("unreachable")


async def pending_approvals(_db: AsyncSession) -> list[dict]:
    reject_multi_company()
    return []


async def company_tasks(_db: AsyncSession) -> list[dict]:
    reject_multi_company()
    return []


async def delete_company(_db: AsyncSession, _company_id: uuid.UUID) -> dict:
    reject_multi_company()
    raise AssertionError("unreachable")
