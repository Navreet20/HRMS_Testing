"""Field-level audit for successful employee-related updates.

Reuses ``EMPLOYEE_FIELD_AUDIT``. Rows are written only after a successful
in-request mutation (same session as the write; commit with the request).
Failed / rolled-back updates never persist audits.

Values for org FKs are resolved to human-readable names on read (and stored
as names when possible on write) so the Activity Log UI never shows raw UUIDs.
"""

from __future__ import annotations

import re
import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tables import (
    Address,
    Department,
    Designation,
    EmergencyContact,
    Employee,
    EmployeeAccessGrant,
    EmployeeSkill,
    LeavePolicy,
    Location,
    ProjectMember,
    Skill,
)
from app.models.awaiting import EmployeeFieldAudit
from app.modules.employee.employment_updates import (
    EMP14_AUDIT_FIELDS,
    build_audit_rows,
    _serialize_value,
)
from app.modules.employee.profile_fields import (
    is_emergency_name_placeholder,
    is_phone_placeholder,
)

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)

# Scalar employee columns audited on every successful profile PATCH.
_EMPLOYEE_SCALAR_FIELDS: tuple[tuple[str, str], ...] = (
    ("firstName", "first_name"),
    ("middleName", "middle_name"),
    ("lastName", "last_name"),
    ("dateOfBirth", "date_of_birth"),
    ("gender", "gender"),
    ("maritalStatus", "marital_status"),
    ("ethnicity", "ethnicity"),
    ("nationality", "nationality"),
    ("phoneNumber", "phone_number"),
    ("alternatePhoneNumber", "alternate_phone_number"),
    ("personalEmail", "personal_email"),
    ("title", "job_description"),
    ("jobDescription", "job_description"),
    ("jobRank", "job_rank"),
    ("role", "role"),
    ("nationalIdCountry", "national_id_country"),
    ("nationalIdDocumentType", "national_id_document_type"),
    ("nationalIdLast4", "national_id_last4"),
    ("dateOfJoining", "employment_start_date"),
    ("employmentStartDate", "employment_start_date"),
    ("payrollStartDate", "payroll_start_date"),
    ("timesheetRequired", "timesheet_required"),
    ("leavePolicyId", "leave_policy_id"),
)

_CONTACT_KEYS = (
    "addressLine1",
    "addressLine2",
    "city",
    "state",
    "postalCode",
    "country",
    "emergencyName",
    "emergencyPhone",
    "emergencyRelation",
    "emergencyEmail",
    "emergencyEmployeeId",
)

_FK_LABEL_FIELDS = frozenset(
    {
        "departmentId",
        "designationId",
        "locationId",
        "reportingManagerId",
        "emergencyEmployeeId",
        "leavePolicyId",
    }
)


def persist_audit_rows(session: AsyncSession, rows: list[dict[str, Any]]) -> int:
    """No EMPLOYEE_FIELD_AUDIT in the 37-table schema. Skip so profile writes do not 501.

    Grant / lifecycle events that must be audited use ``activity_writer.write_log`` directly.
    """
    _ = (session, rows)
    return 0


async def _employee_labels(
    session: AsyncSession, employee_id: UUID
) -> tuple[str | None, str | None, str | None]:
    row = (
        await session.execute(
            select(
                Employee.first_name,
                Employee.last_name,
                Employee.employee_code,
                Employee.business_employee_id,
            ).where(Employee.employee_id == employee_id)
        )
    ).one_or_none()
    if row is None:
        return None, None, None
    first, last, code, business = row
    name = f"{first or ''} {last or ''}".strip() or None
    employee_code = (code or "").strip() or None
    business_id = (business or "").strip() or None
    return name, employee_code, business_id


async def record_profile_audit(
    session: AsyncSession,
    *,
    employee_id: UUID,
    before: dict[str, str | None],
    after: dict[str, str | None],
    actor: dict[str, Any] | None,
    reason: str | None = None,
) -> int:
    # Resolve FK UUIDs → labels before persist so stored history is readable.
    before_r = await resolve_snapshot_labels(session, before)
    after_r = await resolve_snapshot_labels(session, after)
    rows = build_audit_rows(
        employee_id=employee_id,
        before=before_r,
        after=after_r,
        actor=actor,
        reason=reason,
    )
    if not rows:
        return 0
    name, code, business_id = await _employee_labels(session, employee_id)
    for row in rows:
        row["employee_name"] = name
        row["employee_code"] = code
        row["business_employee_id"] = business_id
    try:
        persist_audit_rows(session, rows)
    except HTTPException as exc:
        # employee_field_audit has no table in the 37-table schema (profile audit is Awaiting Refinement).
        if exc.status_code == 501:
            return 0
        raise
    await session.flush()
    return len(rows)


async def record_field_change(
    session: AsyncSession,
    *,
    employee_id: UUID,
    field_name: str,
    old_value: str | None,
    new_value: str | None,
    actor: dict[str, Any] | None,
) -> int:
    """Record a single successful field change (skills, documents, status, …)."""
    if (old_value or None) == (new_value or None):
        return 0
    return await record_profile_audit(
        session,
        employee_id=employee_id,
        before={field_name: old_value},
        after={field_name: new_value},
        actor=actor,
    )


def snapshot_employee_scalars(emp: Any) -> dict[str, str | None]:
    out: dict[str, str | None] = {}
    for api_key, attr in EMP14_AUDIT_FIELDS:
        out[api_key] = _serialize_value(getattr(emp, attr, None))
    for api_key, attr in _EMPLOYEE_SCALAR_FIELDS:
        if api_key in out:
            continue
        out[api_key] = _serialize_value(getattr(emp, attr, None))
    key = getattr(emp, "avatar_object_key", None)
    out["photoUrl"] = "set" if key else None
    return out


async def snapshot_contact(
    session: AsyncSession, employee_id: UUID
) -> dict[str, str | None]:
    addr_result = await session.execute(
        select(Address).where(Address.employee_id == employee_id).limit(1)
    )
    addr = addr_result.scalar_one_or_none()
    emerg_result = await session.execute(
        select(EmergencyContact)
        .where(EmergencyContact.employee_id == employee_id)
        .order_by(
            EmergencyContact.contact_order.asc(),
            EmergencyContact.id.asc(),
        )
    )
    contacts = list(emerg_result.scalars().all())
    emerg = contacts[0] if contacts else None
    alternate = contacts[1] if len(contacts) > 1 else None

    raw_phone = (emerg.phone_number if emerg else None) or ""
    emerg_phone = None if is_phone_placeholder(raw_phone) else _serialize_value(raw_phone)
    alt_phone_raw = (alternate.phone_number if alternate else None) or ""
    alt_phone = (
        None if is_phone_placeholder(alt_phone_raw) else _serialize_value(alt_phone_raw)
    )

    return {
        "addressLine1": _serialize_value(addr.address_line1 if addr else None),
        "addressLine2": _serialize_value(addr.address_line2 if addr else None),
        "city": _serialize_value(addr.city if addr else None),
        "state": _serialize_value(addr.state if addr else None),
        "postalCode": _serialize_value(addr.zip_code if addr else None),
        "country": _serialize_value(addr.country if addr else None),
        "emergencyName": (
            None
            if is_emergency_name_placeholder(emerg.name if emerg else None)
            else _serialize_value(emerg.name if emerg else None)
        ),
        "emergencyPhone": emerg_phone,
        "emergencyRelation": _serialize_value(emerg.relation if emerg else None),
        "emergencyEmail": _serialize_value(emerg.email_id if emerg else None),
        "emergencyEmployeeId": _serialize_value(
            emerg.linked_employee_id if emerg else None
        ),
        "alternateEmergencyName": (
            None
            if is_emergency_name_placeholder(alternate.name if alternate else None)
            else _serialize_value(alternate.name if alternate else None)
        ),
        "alternateEmergencyPhone": alt_phone,
        "alternateEmergencyRelation": _serialize_value(
            alternate.relation if alternate else None
        ),
        "alternateEmergencyEmail": _serialize_value(
            getattr(alternate, "email", None) if alternate else None
        ),
    }


async def snapshot_access_flags(
    session: AsyncSession, employee_id: UUID
) -> dict[str, str | None]:
    """Map live employee_access_grants into the legacy create/view/edit/full flags."""
    result = await session.execute(
        select(EmployeeAccessGrant.access_level).where(
            EmployeeAccessGrant.employee_id == employee_id,
            EmployeeAccessGrant.revoked_at.is_(None),
        )
    )
    levels = {str(level) for level in result.scalars().all() if level}
    has_any = bool(levels)
    has_edit = bool(levels & {"Edit", "Manage"})
    has_manage = "Manage" in levels
    return {
        "createAccess": "true" if has_edit else "false",
        "viewAccess": "true" if has_any else "false",
        "editAccess": "true" if has_edit else "false",
        "fullAccess": "true" if has_manage else "false",
    }


async def snapshot_skills(
    session: AsyncSession, employee_id: UUID
) -> dict[str, str | None]:
    result = await session.execute(
        select(Skill.skill_name)
        .join(EmployeeSkill, EmployeeSkill.skill_id == Skill.skill_id)
        .where(EmployeeSkill.employee_id == employee_id)
        .order_by(Skill.skill_name)
    )
    names = [str(n).strip() for n in result.scalars().all() if n]
    return {"skills": ", ".join(names) if names else None}


async def snapshot_projects(
    session: AsyncSession, employee_id: UUID
) -> dict[str, str | None]:
    from app.models.tables import Project

    result = await session.execute(
        select(Project.name)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .where(ProjectMember.employee_id == employee_id)
        .order_by(Project.name)
    )
    names = [str(n).strip() for n in result.scalars().all() if n]
    return {"projects": ", ".join(names) if names else None}


async def snapshot_profile(
    session: AsyncSession, emp: Employee
) -> dict[str, str | None]:
    snap = snapshot_employee_scalars(emp)
    contact = await snapshot_contact(session, emp.employee_id)
    snap.update(contact)
    snap.update(await snapshot_access_flags(session, emp.employee_id))
    snap.update(await snapshot_skills(session, emp.employee_id))
    snap.update(await snapshot_projects(session, emp.employee_id))
    return snap


async def _lookup_department_name(session: AsyncSession, value: str) -> str | None:
    try:
        eid = uuid.UUID(value)
    except ValueError:
        return None
    name = (
        await session.execute(
            select(Department.department_name).where(Department.department_id == eid)
        )
    ).scalar_one_or_none()
    return str(name).strip() if name else None


async def _lookup_designation_title(session: AsyncSession, value: str) -> str | None:
    try:
        eid = uuid.UUID(value)
    except ValueError:
        return None
    title = (
        await session.execute(
            select(Designation.title).where(Designation.designation_id == eid)
        )
    ).scalar_one_or_none()
    return str(title).strip() if title else None


async def _lookup_location_name(session: AsyncSession, value: str) -> str | None:
    try:
        eid = uuid.UUID(value)
    except ValueError:
        return None
    name = (
        await session.execute(
            select(Location.location_name).where(Location.location_id == eid)
        )
    ).scalar_one_or_none()
    return str(name).strip() if name else None


async def _lookup_employee_label(session: AsyncSession, value: str) -> str | None:
    try:
        eid = uuid.UUID(value)
    except ValueError:
        return None
    row = (
        await session.execute(
            select(Employee.first_name, Employee.last_name, Employee.employee_code).where(
                Employee.employee_id == eid
            )
        )
    ).one_or_none()
    if row is None:
        return None
    first, last, code = row
    name = f"{first or ''} {last or ''}".strip()
    if name and code:
        return f"{name} ({code})"
    return name or (str(code).strip() if code else None)


async def _lookup_leave_policy_name(session: AsyncSession, value: str) -> str | None:
    try:
        eid = uuid.UUID(value)
    except ValueError:
        return None
    name = (
        await session.execute(
            select(LeavePolicy.policy_name).where(LeavePolicy.policy_id == eid)
        )
    ).scalar_one_or_none()
    return str(name).strip() if name else None


async def resolve_display_value(
    session: AsyncSession,
    field_name: str,
    value: str | None,
    memo: dict[tuple[str, str], str | None] | None = None,
) -> str | None:
    """Readable label for an audit value; pass one ``memo`` per list so a
    repeated id (the same department, manager…) is looked up once."""
    if value is None or value == "":
        return value
    text = str(value).strip()
    if field_name not in _FK_LABEL_FIELDS:
        return text
    if not _UUID_RE.match(text):
        return text
    if memo is None:
        return await _resolve_fk_label(session, field_name, text)
    key = (field_name, text)
    if key not in memo:
        memo[key] = await _resolve_fk_label(session, field_name, text)
    return memo[key]


async def _resolve_fk_label(
    session: AsyncSession, field_name: str, text: str
) -> str | None:
    if field_name == "departmentId":
        return await _lookup_department_name(session, text) or text
    if field_name == "designationId":
        return await _lookup_designation_title(session, text) or text
    if field_name == "locationId":
        return await _lookup_location_name(session, text) or text
    if field_name in {"reportingManagerId", "emergencyEmployeeId"}:
        return await _lookup_employee_label(session, text) or text
    if field_name == "leavePolicyId":
        return await _lookup_leave_policy_name(session, text) or text
    return text


async def resolve_snapshot_labels(
    session: AsyncSession, snap: dict[str, str | None]
) -> dict[str, str | None]:
    out: dict[str, str | None] = {}
    for key, value in snap.items():
        out[key] = await resolve_display_value(session, key, value)
    return out


def _employee_display_name(emp: Employee) -> str:
    return f"{emp.first_name or ''} {emp.last_name or ''}".strip() or "—"


async def audit_row_to_dict(
    session: AsyncSession,
    row: EmployeeFieldAudit,
    emp: Employee | None,
    memo: dict[tuple[str, str], str | None] | None = None,
) -> dict[str, Any]:
    if emp is not None:
        employee_name = _employee_display_name(emp)
        employee_code = (emp.employee_code or "").strip() or None
        business_employee_id = (emp.business_employee_id or "").strip() or None
        employee_id = str(emp.employee_id)
    else:
        employee_name = row.employee_name or "Deleted employee"
        employee_code = (row.employee_code or "").strip() or None
        business_employee_id = (row.business_employee_id or "").strip() or None
        employee_id = str(row.employee_id) if row.employee_id else ""
    return {
        "id": str(row.id),
        "employeeId": employee_id,
        "employeeCode": employee_code,
        "businessEmployeeId": business_employee_id,
        "employeeName": employee_name,
        "fieldName": row.field_name,
        "oldValue": await resolve_display_value(
            session, row.field_name, row.old_value, memo
        ),
        "newValue": await resolve_display_value(
            session, row.field_name, row.new_value, memo
        ),
        "changedBy": row.changed_by,
        "changedById": row.changed_by_id,
        "changedByRole": row.changed_by_role,
        "changedAt": row.changed_at.isoformat() if row.changed_at else None,
    }


def _utc_day_start(day: date) -> datetime:
    return datetime.combine(day, time.min, tzinfo=timezone.utc)


async def list_profile_audit(
    session: AsyncSession,
    *,
    employee_id: UUID | None = None,
    q: str | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    page: int = 1,
    page_size: int = 50,
) -> dict[str, Any]:
    page = max(1, page)
    page_size = min(max(1, page_size), 200)
    # Over-fetch from each source so merged pagination stays correct.
    fetch_limit = page * page_size

    base = select(EmployeeFieldAudit, Employee).outerjoin(
        Employee, Employee.employee_id == EmployeeFieldAudit.employee_id
    )
    count_base = select(func.count()).select_from(EmployeeFieldAudit)

    # Hide rows that still point at system accounts (when employee still exists).
    base = base.where(
        (Employee.employee_id.is_(None)) | (Employee.is_system_account.is_(False))
    )

    if employee_id is not None:
        base = base.where(EmployeeFieldAudit.employee_id == employee_id)
        count_base = count_base.where(EmployeeFieldAudit.employee_id == employee_id)

    range_start = from_date
    range_end = to_date
    if range_start and range_end and range_start > range_end:
        range_start, range_end = range_end, range_start

    if range_start is not None:
        start_at = _utc_day_start(range_start)
        base = base.where(EmployeeFieldAudit.changed_at >= start_at)
        count_base = count_base.where(EmployeeFieldAudit.changed_at >= start_at)

    if range_end is not None:
        # Inclusive end date: keep rows before the next UTC day.
        end_exclusive = _utc_day_start(range_end) + timedelta(days=1)
        base = base.where(EmployeeFieldAudit.changed_at < end_exclusive)
        count_base = count_base.where(EmployeeFieldAudit.changed_at < end_exclusive)

    needle = (q or "").strip()
    if needle:
        # Prefix match on employee identity only (not field values / changed-by).
        pattern = f"{needle}%"
        full_name = func.concat(
            func.coalesce(Employee.first_name, ""),
            " ",
            func.coalesce(Employee.last_name, ""),
        )
        name_filter = (
            (Employee.first_name.ilike(pattern))
            | (Employee.last_name.ilike(pattern))
            | (full_name.ilike(pattern))
            | (EmployeeFieldAudit.employee_name.ilike(pattern))
            | (Employee.employee_code.ilike(pattern))
            | (Employee.business_employee_id.ilike(pattern))
            | (EmployeeFieldAudit.employee_code.ilike(pattern))
            | (EmployeeFieldAudit.business_employee_id.ilike(pattern))
        )
        base = base.where(name_filter)
        count_base = count_base.where(
            EmployeeFieldAudit.id.in_(
                select(EmployeeFieldAudit.id)
                .outerjoin(
                    Employee, Employee.employee_id == EmployeeFieldAudit.employee_id
                )
                .where(name_filter)
            )
        )

    field_total = int((await session.execute(count_base)).scalar_one() or 0)
    result = await session.execute(
        base.order_by(
            EmployeeFieldAudit.changed_at.desc().nullslast(),
            EmployeeFieldAudit.id.desc(),
        ).limit(fetch_limit)
    )
    label_memo: dict[tuple[str, str], str | None] = {}
    field_items = [
        await audit_row_to_dict(session, audit, emp, label_memo)
        for audit, emp in result.all()
    ]

    from app.modules.rbac.grant_audit import list_grant_audit_as_trail

    grant_total, grant_items = await list_grant_audit_as_trail(
        session,
        employee_id=employee_id,
        q=q,
        from_date=from_date,
        to_date=to_date,
        fetch_limit=fetch_limit,
    )

    def _sort_key(item: dict[str, Any]) -> tuple[str, str]:
        return (item.get("changedAt") or "", item.get("id") or "")

    merged = sorted(field_items + grant_items, key=_sort_key, reverse=True)
    start = (page - 1) * page_size
    items = merged[start : start + page_size]
    return {
        "items": items,
        "total": field_total + grant_total,
        "page": page,
        "pageSize": page_size,
    }


PROFILE_CONTACT_AUDIT_KEYS = _CONTACT_KEYS
