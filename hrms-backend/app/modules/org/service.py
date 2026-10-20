"""Org masters (departments, designations, locations) on the 37-table schema.

The new schema has a single company and no ``company_id`` / audit columns on these three tables, and "status" is the
boolean ``is_active``. The API keeps its old camelCase shape: ``status`` is ``"Active"`` / ``"Inactive"``,
``companyId`` is the one company's id, and audit fields are ``None``.
"""
from __future__ import annotations

import re
import uuid
from typing import Any, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.role_groups import ADMIN_ROLES
from app.core.roles import session_access_roles
from app.models.tables import Company, Department, Designation, Employee, Location
from app.modules.org.geo import (
    city_is_required,
    lookup_country_code,
    lookup_state_code,
    subdivisions_for,
)

MASTER_STATUS_ACTIVE = "Active"
MASTER_STATUS_INACTIVE = "Inactive"
DEPARTMENT_NAME_TAKEN = "A department with this name already exists."
DESIGNATION_TITLE_TAKEN = "A job title with this name already exists."
DESIGNATION_JOB_FAMILIES = frozenset({"Engineering", "Delivery", "Support", "Corporate"})
ORG_MASTER_COMPANY_REQUIRED = "Company context is required."
INVALID_ORG_MASTER_COMPANY = "Invalid companyId."
MasterKind = Literal["department", "designation", "location"]

LOCATION_CODE_TAKEN = "An office with this short code already exists."
LOCATION_COMPANY_REQUIRED = ORG_MASTER_COMPANY_REQUIRED
INVALID_LOCATION_COMPANY = INVALID_ORG_MASTER_COMPANY
INVALID_LOCATION_TIMEZONE = "Timezone is not valid. Pick a timezone from the list."
INVALID_LOCATION_COUNTRY = "Country is not valid. Pick a country from the list."
INVALID_LOCATION_STATE = "State is not valid. Pick a state from the list."
INVALID_US_ZIP = "ZIP code must be 5 digits."
_US_ZIP_PATTERN = re.compile(r"^\d{5}(?:-\d{4})?$")


def _parse_job_family(raw: Any, *, required: bool) -> str | None:
    value = str(raw or "").strip()
    if not value:
        if required:
            raise HTTPException(status_code=400, detail="jobFamily is required")
        return None
    if value not in DESIGNATION_JOB_FAMILIES:
        raise HTTPException(
            status_code=400,
            detail="jobFamily must be one of: Engineering, Delivery, Support, Corporate",
        )
    return value


_MASTER_MODELS = {
    "department": (Department, "departmentId"),
    "designation": (Designation, "designationId"),
    "location": (Location, "locationId"),
}


def viewer_sees_inactive(user: dict[str, Any] | None) -> bool:
    """Admin/Superadmin manage Active+Inactive. HR pickers see Active only."""
    if user is None:
        return False
    if get_settings().auth_bypass:
        return True
    roles = session_access_roles(user)
    return bool(roles.intersection({role.value for role in ADMIN_ROLES}))


def _status_text(is_active: bool | None) -> str:
    return MASTER_STATUS_INACTIVE if is_active is False else MASTER_STATUS_ACTIVE


def _parse_status(value: Any) -> str:
    if value is None or value == "":
        return MASTER_STATUS_ACTIVE
    lowered = str(value).strip().lower()
    if lowered == MASTER_STATUS_ACTIVE.lower():
        return MASTER_STATUS_ACTIVE
    if lowered == MASTER_STATUS_INACTIVE.lower():
        return MASTER_STATUS_INACTIVE
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="status must be Active or Inactive",
    )


def _parse_company_id(value: Any) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=INVALID_ORG_MASTER_COMPANY) from exc


async def resolve_org_master_company_id(
    db: AsyncSession,
    actor: dict[str, Any],
    body: dict[str, Any] | None = None,
) -> uuid.UUID:
    """The one company's id (the schema holds a single ``companies`` row)."""
    result = await db.execute(select(Company.id).order_by(Company.name).limit(1))
    default_id = result.scalar_one_or_none()
    if default_id is None:
        raise HTTPException(status_code=400, detail=ORG_MASTER_COMPANY_REQUIRED)
    return default_id


async def _company_id_str(db: AsyncSession) -> str | None:
    result = await db.execute(select(Company.id).order_by(Company.name).limit(1))
    value = result.scalar_one_or_none()
    return str(value) if value else None


# --------------------------------------------------------------------------------------------- serializers
def department_to_dict(
    row: Department,
    *,
    head_names: dict[uuid.UUID, str] | None = None,
    company_id: str | None = None,
) -> dict[str, Any]:
    head_id = row.head_employee_id
    head_name = head_names.get(head_id) if (head_id is not None and head_names is not None) else None
    return {
        "departmentId": str(row.id),
        "companyId": company_id,
        "departmentName": row.name,
        "departmentHeadId": str(head_id) if head_id else None,
        "departmentHeadName": head_name,
        "parentDepartmentId": str(row.parent_department_id) if row.parent_department_id else None,
        "status": _status_text(row.is_active),
        "createdBy": None,
        "updatedBy": None,
        "createdDate": None,
        "updatedDate": None,
    }


def location_to_dict(row: Location, *, company_id: str | None = None) -> dict[str, Any]:
    return {
        "locationId": str(row.id),
        "companyId": company_id,
        "locationName": row.name,
        "addressLine1": row.address_line_1,
        "addressLine2": row.address_line_2,
        "city": row.city,
        "state": row.state,
        "zip": row.postal_code,
        "country": row.country_code,
        "timezone": row.timezone,
        "locationCode": None,
        "locationType": None,
        "status": _status_text(row.is_active),
        "createdBy": None,
        "updatedBy": None,
        "createdDate": None,
        "updatedDate": None,
    }


def designation_to_dict(row: Designation, *, company_id: str | None = None) -> dict[str, Any]:
    return {
        "designationId": str(row.id),
        "companyId": company_id,
        "title": row.name,
        "jobFamily": None,
        "status": _status_text(row.is_active),
        "createdBy": None,
        "updatedBy": None,
        "createdDate": None,
        "updatedDate": None,
    }


# ------------------------------------------------------------------------------------------------ helpers
def _parse_uuid(value: Any, field: str) -> uuid.UUID | None:
    if value is None or value == "":
        return None
    try:
        return uuid.UUID(str(value))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid {field}"
        ) from exc


async def _ensure_employee(db: AsyncSession, employee_id: uuid.UUID | None) -> None:
    if employee_id is None:
        return
    emp = (await db.execute(select(Employee).where(Employee.id == employee_id))).scalar_one_or_none()
    if emp is None:
        raise HTTPException(status_code=400, detail="departmentHeadId employee not found")
    if bool(getattr(emp, "is_system_account", False)):
        raise HTTPException(status_code=400, detail="departmentHeadId cannot be a system account")
    if (emp.status or "") != "Active":
        raise HTTPException(status_code=400, detail="departmentHeadId must be an active employee")


async def _department_head_names(
    db: AsyncSession, head_ids: set[uuid.UUID]
) -> dict[uuid.UUID, str]:
    if not head_ids:
        return {}
    result = await db.execute(
        select(Employee.id, Employee.first_name, Employee.last_name).where(Employee.id.in_(head_ids))
    )
    names: dict[uuid.UUID, str] = {}
    for employee_id, first_name, last_name in result.all():
        label = f"{(first_name or '').strip()} {(last_name or '').strip()}".strip()
        if label:
            names[employee_id] = label
    return names


async def _assigned_employee_count(db: AsyncSession, column: Any, master_id: uuid.UUID) -> int:
    result = await db.execute(select(func.count()).select_from(Employee).where(column == master_id))
    return int(result.scalar_one() or 0)


async def _assert_no_child_departments(db: AsyncSession, department_id: uuid.UUID) -> None:
    result = await db.execute(
        select(Department.id).where(Department.parent_department_id == department_id).limit(1)
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="Department has child departments")


async def _assert_not_assigned(
    db: AsyncSession, *, column: Any, master_id: uuid.UUID, label: str
) -> None:
    count = await _assigned_employee_count(db, column, master_id)
    if count:
        raise HTTPException(status_code=400, detail=f"{label} is assigned to {count} employee(s)")


async def assert_active_master(db: AsyncSession, kind: MasterKind, master_id: uuid.UUID) -> None:
    """Reject missing or Inactive org masters on employee create/update."""
    model, field = _MASTER_MODELS[kind]
    result = await db.execute(select(model.is_active).where(model.id == master_id))
    row = result.first()
    if row is None:
        raise HTTPException(status_code=400, detail=f"{field} not found")
    if row[0] is False:
        raise HTTPException(status_code=400, detail=f"{field} is not Active")


async def _assert_unique_department_name(
    db: AsyncSession, company_id: Any, name: str, *, exclude_id: uuid.UUID | None = None
) -> None:
    stmt = select(Department.id).where(func.lower(Department.name) == name.lower())
    if exclude_id is not None:
        stmt = stmt.where(Department.id != exclude_id)
    if (await db.execute(stmt.limit(1))).scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail=DEPARTMENT_NAME_TAKEN)


async def _assert_unique_designation_title(
    db: AsyncSession, company_id: Any, title: str, *, exclude_id: uuid.UUID | None = None
) -> None:
    stmt = select(Designation.id).where(func.lower(Designation.name) == title.lower())
    if exclude_id is not None:
        stmt = stmt.where(Designation.id != exclude_id)
    if (await db.execute(stmt.limit(1))).scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail=DESIGNATION_TITLE_TAKEN)


async def _flush_unique(db: AsyncSession, *, index_name: str, detail: str) -> None:
    """Map a unique-index clash to 409; let other integrity errors through."""
    try:
        await db.flush()
    except IntegrityError as exc:
        message = str(getattr(exc, "orig", exc))
        if index_name in message:
            raise HTTPException(status_code=409, detail=detail) from exc
        raise


async def _require_active_parent(db: AsyncSession, parent_id: uuid.UUID, company_id: Any) -> None:
    parent = (
        await db.execute(select(Department).where(Department.id == parent_id))
    ).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=400, detail="That parent department was not found.")
    if parent.is_active is False:
        raise HTTPException(status_code=400, detail="The parent department must be active.")


async def _assert_no_parent_cycle(
    db: AsyncSession, department_id: uuid.UUID, parent_id: uuid.UUID
) -> None:
    """Reject A→B→A (and longer loops) when setting parentDepartmentId."""
    seen: set[uuid.UUID] = set()
    current: uuid.UUID | None = parent_id
    while current is not None:
        if current == department_id:
            raise HTTPException(
                status_code=400,
                detail="This parent would loop the org chart. Choose a different parent.",
            )
        if current in seen:
            return
        seen.add(current)
        current = (
            await db.execute(select(Department.parent_department_id).where(Department.id == current))
        ).scalar_one_or_none()


# ------------------------------------------------------------------------------------------- departments
async def _department_dicts(db: AsyncSession, rows: list[Department]) -> list[dict]:
    company_id = await _company_id_str(db)
    head_names = await _department_head_names(
        db, {row.head_employee_id for row in rows if row.head_employee_id is not None}
    )
    return [department_to_dict(row, head_names=head_names, company_id=company_id) for row in rows]


async def list_departments(
    db: AsyncSession, actor: dict[str, Any], *, include_inactive: bool = False
) -> list[dict]:
    stmt = select(Department).order_by(Department.name)
    if not include_inactive:
        stmt = stmt.where(Department.is_active.is_(True))
    rows = list((await db.execute(stmt)).scalars().all())
    return await _department_dicts(db, rows)


async def get_department(
    db: AsyncSession,
    actor: dict[str, Any],
    department_id: uuid.UUID,
    *,
    include_inactive: bool = False,
) -> dict:
    row = (
        await db.execute(select(Department).where(Department.id == department_id))
    ).scalar_one_or_none()
    if row is None or (not include_inactive and row.is_active is False):
        raise HTTPException(status_code=404, detail="Department not found")
    return (await _department_dicts(db, [row]))[0]


async def create_department(db: AsyncSession, actor: dict, body: dict[str, Any]) -> dict:
    name = (body.get("departmentName") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="departmentName is required")
    company_id = await resolve_org_master_company_id(db, actor, body)
    await _assert_unique_department_name(db, company_id, name)
    head_id = _parse_uuid(body.get("departmentHeadId"), "departmentHeadId")
    parent_id = _parse_uuid(body.get("parentDepartmentId"), "parentDepartmentId")
    await _ensure_employee(db, head_id)
    if parent_id is not None:
        await _require_active_parent(db, parent_id, company_id)
    row = Department(
        id=uuid.uuid4(), name=name, head_employee_id=head_id,
        parent_department_id=parent_id, is_active=True,
    )
    db.add(row)
    await _flush_unique(db, index_name="uq_departments_name", detail=DEPARTMENT_NAME_TAKEN)
    return (await _department_dicts(db, [row]))[0]


async def update_department(
    db: AsyncSession, actor: dict, department_id: uuid.UUID, body: dict[str, Any]
) -> dict:
    company_id = await resolve_org_master_company_id(db, actor)
    row = (
        await db.execute(select(Department).where(Department.id == department_id))
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Department not found")
    if "departmentName" in body and body["departmentName"] is not None:
        name = str(body["departmentName"]).strip()
        if not name:
            raise HTTPException(status_code=400, detail="departmentName cannot be empty")
        await _assert_unique_department_name(db, company_id, name, exclude_id=department_id)
        row.name = name
    if "departmentHeadId" in body:
        head_id = _parse_uuid(body.get("departmentHeadId"), "departmentHeadId")
        await _ensure_employee(db, head_id)
        row.head_employee_id = head_id
    if "parentDepartmentId" in body:
        parent_id = _parse_uuid(body.get("parentDepartmentId"), "parentDepartmentId")
        if parent_id == department_id:
            raise HTTPException(status_code=400, detail="A department cannot be its own parent.")
        if parent_id is not None:
            await _require_active_parent(db, parent_id, company_id)
            await _assert_no_parent_cycle(db, department_id, parent_id)
        row.parent_department_id = parent_id
    if "status" in body:
        next_status = _parse_status(body.get("status"))
        if next_status == MASTER_STATUS_INACTIVE:
            await _assert_no_child_departments(db, department_id)
            await _assert_not_assigned(
                db, column=Employee.department_id, master_id=department_id, label="Department"
            )
        row.is_active = next_status == MASTER_STATUS_ACTIVE
    await _flush_unique(db, index_name="uq_departments_name", detail=DEPARTMENT_NAME_TAKEN)
    return (await _department_dicts(db, [row]))[0]


async def deactivate_department(db: AsyncSession, actor: dict, department_id: uuid.UUID) -> dict:
    return await update_department(db, actor, department_id, {"status": MASTER_STATUS_INACTIVE})


async def activate_department(db: AsyncSession, actor: dict, department_id: uuid.UUID) -> dict:
    return await update_department(db, actor, department_id, {"status": MASTER_STATUS_ACTIVE})


# --------------------------------------------------------------------------------------------- locations
async def list_locations(
    db: AsyncSession, actor: dict[str, Any], *, include_inactive: bool = False
) -> list[dict]:
    company_id = await _company_id_str(db)
    stmt = select(Location).order_by(Location.name)
    if not include_inactive:
        stmt = stmt.where(Location.is_active.is_(True))
    rows = (await db.execute(stmt)).scalars().all()
    return [location_to_dict(row, company_id=company_id) for row in rows]


async def get_location(
    db: AsyncSession,
    actor: dict[str, Any],
    location_id: uuid.UUID,
    *,
    include_inactive: bool = False,
) -> dict:
    row = (await db.execute(select(Location).where(Location.id == location_id))).scalar_one_or_none()
    if row is None or (not include_inactive and row.is_active is False):
        raise HTTPException(status_code=404, detail="Location not found")
    return location_to_dict(row, company_id=await _company_id_str(db))


def _required_text(body: dict[str, Any], field: str, *, detail: str) -> str:
    raw = body.get(field)
    value = raw.strip() if isinstance(raw, str) else raw
    if value is None or (isinstance(value, str) and not str(value).strip()):
        raise HTTPException(status_code=400, detail=detail)
    return str(value).strip()


def _optional_text(body: dict[str, Any], field: str) -> str | None:
    raw = body.get(field)
    if raw is None:
        return None
    text = str(raw).strip()
    return text or None


def _parse_location_city(country: str, value: Any) -> str | None:
    text = str(value or "").strip()
    if text:
        return text
    if city_is_required(country):
        raise HTTPException(status_code=400, detail="City is required.")
    return None


def parse_location_timezone(value: Any) -> str:
    """Require a real IANA zone (``zoneinfo.ZoneInfo``). Rejects ``fusgbseu``."""
    if value is None or (isinstance(value, str) and not value.strip()):
        raise HTTPException(status_code=400, detail="Timezone is required.")
    name = str(value).strip()
    try:
        ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError, KeyError) as exc:
        raise HTTPException(status_code=400, detail=INVALID_LOCATION_TIMEZONE) from exc
    return name


def parse_location_country(value: Any) -> str:
    """Normalize country to ISO 3166-1 alpha-2 (``US``). Accepts ``US`` or ``United States``."""
    if value is None or (isinstance(value, str) and not value.strip()):
        raise HTTPException(status_code=400, detail="Country is required.")
    mapped = lookup_country_code(str(value).strip())
    if mapped is None:
        raise HTTPException(status_code=400, detail=INVALID_LOCATION_COUNTRY)
    return mapped


def parse_location_state(country: Any, value: Any) -> str | None:
    """Require a listed subdivision when we have one; store unmatched values as text."""
    country_code = lookup_country_code(str(country).strip()) if country else None
    has_list = country_code is not None and subdivisions_for(country_code) is not None
    if value is None or (isinstance(value, str) and not str(value).strip()):
        if has_list:
            raise HTTPException(status_code=400, detail="State or region is required.")
        return None
    text = str(value).strip()
    if country_code is None or not has_list:
        return text
    mapped = lookup_state_code(country_code, text)
    return mapped if mapped is not None else text


def parse_location_zip(country: Any, value: Any) -> str | None:
    """ZIP is required for US (5 digits or ZIP+4). Postal code is optional elsewhere."""
    text = "" if value is None else str(value).strip()
    country_code = lookup_country_code(str(country).strip()) if country else None
    if country_code == "US":
        if not text:
            raise HTTPException(status_code=400, detail="ZIP code is required.")
        if _US_ZIP_PATTERN.fullmatch(text) is None:
            raise HTTPException(status_code=400, detail=INVALID_US_ZIP)
        return text
    return text or None


def _timezone_from_body(body: dict[str, Any]) -> Any:
    if "timezone" in body:
        return body.get("timezone")
    return body.get("timeZone")


async def create_location(db: AsyncSession, actor: dict, body: dict[str, Any]) -> dict:
    name = (body.get("locationName") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Office name is required.")
    address_line_1 = _required_text(body, "addressLine1", detail="Street address is required.")
    country = parse_location_country(body.get("country"))
    city = _parse_location_city(country, body.get("city"))
    state = parse_location_state(country, body.get("state"))
    zip_code = parse_location_zip(country, body.get("zip"))
    timezone_name = parse_location_timezone(_timezone_from_body(body))
    row = Location(
        id=uuid.uuid4(),
        name=name,
        address_line_1=address_line_1,
        address_line_2=_optional_text(body, "addressLine2"),
        city=city,
        state=state,
        postal_code=zip_code,
        country_code=country,
        timezone=timezone_name,
        is_active=True,
    )
    db.add(row)
    await _flush_unique(db, index_name="uq_locations_name", detail="An office with this name already exists.")
    return location_to_dict(row, company_id=await _company_id_str(db))


async def update_location(
    db: AsyncSession, actor: dict, location_id: uuid.UUID, body: dict[str, Any]
) -> dict:
    row = (await db.execute(select(Location).where(Location.id == location_id))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Location not found")
    if "locationName" in body and body["locationName"] is not None:
        name = str(body["locationName"]).strip()
        if not name:
            raise HTTPException(status_code=400, detail="Office name cannot be empty.")
        row.name = name
    if "addressLine1" in body:
        line1 = str(body.get("addressLine1") or "").strip()
        if not line1:
            raise HTTPException(status_code=400, detail="Street address is required.")
        row.address_line_1 = line1
    if "addressLine2" in body:
        row.address_line_2 = _optional_text(body, "addressLine2")
    if "city" in body:
        country_for_city = (
            parse_location_country(body.get("country")) if "country" in body else row.country_code
        )
        row.city = _parse_location_city(str(country_for_city or ""), body.get("city"))
    if "country" in body:
        row.country_code = parse_location_country(body.get("country"))
    if "state" in body:
        row.state = parse_location_state(row.country_code, body.get("state"))
    elif "country" in body and subdivisions_for(row.country_code) is not None:
        row.state = parse_location_state(row.country_code, row.state)
    if "zip" in body:
        row.postal_code = parse_location_zip(row.country_code, body.get("zip"))
    elif "country" in body:
        row.postal_code = parse_location_zip(row.country_code, row.postal_code)
    if "timezone" in body or "timeZone" in body:
        row.timezone = parse_location_timezone(_timezone_from_body(body))
    if "status" in body:
        next_status = _parse_status(body.get("status"))
        if next_status == MASTER_STATUS_INACTIVE:
            await _assert_not_assigned(
                db, column=Employee.location_id, master_id=location_id, label="Location"
            )
        row.is_active = next_status == MASTER_STATUS_ACTIVE
    await _flush_unique(db, index_name="uq_locations_name", detail="An office with this name already exists.")
    return location_to_dict(row, company_id=await _company_id_str(db))


async def deactivate_location(db: AsyncSession, actor: dict, location_id: uuid.UUID) -> dict:
    return await update_location(db, actor, location_id, {"status": MASTER_STATUS_INACTIVE})


async def activate_location(db: AsyncSession, actor: dict, location_id: uuid.UUID) -> dict:
    return await update_location(db, actor, location_id, {"status": MASTER_STATUS_ACTIVE})


# ---------------------------------------------------------------------------------------------designations
async def list_designations(
    db: AsyncSession, actor: dict[str, Any], *, include_inactive: bool = False
) -> list[dict]:
    company_id = await _company_id_str(db)
    stmt = select(Designation).order_by(Designation.name)
    if not include_inactive:
        stmt = stmt.where(Designation.is_active.is_(True))
    rows = (await db.execute(stmt)).scalars().all()
    return [designation_to_dict(row, company_id=company_id) for row in rows]


async def get_designation(
    db: AsyncSession,
    actor: dict[str, Any],
    designation_id: uuid.UUID,
    *,
    include_inactive: bool = False,
) -> dict:
    row = (
        await db.execute(select(Designation).where(Designation.id == designation_id))
    ).scalar_one_or_none()
    if row is None or (not include_inactive and row.is_active is False):
        raise HTTPException(status_code=404, detail="Designation not found")
    return designation_to_dict(row, company_id=await _company_id_str(db))


async def create_designation(db: AsyncSession, actor: dict, body: dict[str, Any]) -> dict:
    title = (body.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="title is required")
    # jobFamily is accepted but not stored (the new schema has no job-family column).
    _parse_job_family(body.get("jobFamily"), required=False)
    company_id = await resolve_org_master_company_id(db, actor, body)
    await _assert_unique_designation_title(db, company_id, title)
    row = Designation(id=uuid.uuid4(), name=title, is_active=True)
    db.add(row)
    await _flush_unique(db, index_name="uq_designations_name", detail=DESIGNATION_TITLE_TAKEN)
    return designation_to_dict(row, company_id=str(company_id))


async def update_designation(
    db: AsyncSession, actor: dict, designation_id: uuid.UUID, body: dict[str, Any]
) -> dict:
    company_id = await resolve_org_master_company_id(db, actor)
    row = (
        await db.execute(select(Designation).where(Designation.id == designation_id))
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Designation not found")
    if "title" in body and body["title"] is not None:
        title = str(body["title"]).strip()
        if not title:
            raise HTTPException(status_code=400, detail="title cannot be empty")
        await _assert_unique_designation_title(db, company_id, title, exclude_id=designation_id)
        row.name = title
    if "jobFamily" in body:
        _parse_job_family(body.get("jobFamily"), required=False)
    if "status" in body:
        next_status = _parse_status(body.get("status"))
        if next_status == MASTER_STATUS_INACTIVE:
            await _assert_not_assigned(
                db, column=Employee.designation_id, master_id=designation_id, label="Designation"
            )
        row.is_active = next_status == MASTER_STATUS_ACTIVE
    await _flush_unique(db, index_name="uq_designations_name", detail=DESIGNATION_TITLE_TAKEN)
    return designation_to_dict(row, company_id=str(company_id))


async def deactivate_designation(db: AsyncSession, actor: dict, designation_id: uuid.UUID) -> dict:
    return await update_designation(db, actor, designation_id, {"status": MASTER_STATUS_INACTIVE})


async def activate_designation(db: AsyncSession, actor: dict, designation_id: uuid.UUID) -> dict:
    return await update_designation(db, actor, designation_id, {"status": MASTER_STATUS_ACTIVE})
