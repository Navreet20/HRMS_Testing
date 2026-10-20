"""EMP-1.4 HR-managed employment & assignment updates."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import HTTPException

from app.core.roles import Role, Status
from app.modules.employee.access import actor_role

# Employment statuses HR may set via PATCH (lifecycle NEW/PENDING stay on transitions).
EMP14_EMPLOYMENT_STATUSES = frozenset(
    {
        Status.ACTIVE.value,
        Status.INACTIVE.value,
    }
)

EMP14_BODY_KEYS = frozenset(
    {
        "departmentId",
        "designationId",
        "locationId",
        "reportingManagerId",
        "employmentType",
        "status",
        "gradeBand",
        "probationEndDate",
        "workMode",
        "officialEmail",
        "emailId",
        "assignedCountry",
        "payrollStartDate",
        "timesheetRequired",
        "leavePolicyId",
        "dateOfJoining",
        "employmentStartDate",
        "nationalIdCountry",
        "nationalIdDocumentType",
        "nationalIdNumber",
    }
)

# Snapshot / audit field names (API-ish keys).
EMP14_AUDIT_FIELDS: tuple[tuple[str, str], ...] = (
    ("departmentId", "department_id"),
    ("designationId", "designation_id"),
    ("locationId", "location_id"),
    ("reportingManagerId", "reporting_manager_id"),
    ("employmentType", "employment_type"),
    ("status", "status"),
    ("gradeBand", "grade_band"),
    ("probationEndDate", "probation_end_date"),
    ("workMode", "work_mode"),
    ("officialEmail", "email_id"),
    ("assignedCountry", "assigned_country"),
    ("timesheetRequired", "timesheet_required"),
    ("leavePolicyId", "leave_policy_id"),
)


def body_has_emp14_fields(body: dict[str, Any]) -> bool:
    return any(key in body for key in EMP14_BODY_KEYS)


def assert_can_apply_emp14(claims: dict[str, Any]) -> None:
    """EMP-1.4 is HR-managed (plus admin/accountant staff) — not employee self-service."""
    role = actor_role(claims)
    if role == Role.EMPLOYEE.value:
        raise HTTPException(
            status_code=403,
            detail="Employment and assignment fields require HR permissions",
        )


def normalize_emp14_status(value: Any) -> str:
    from app.modules.employee.status import canonicalize_employee_status

    normalized = canonicalize_employee_status(value)
    if normalized not in EMP14_EMPLOYMENT_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid employment status; allowed: Active, Inactive "
                "(use lifecycle transitions for NEW/PENDING)"
            ),
        )
    return normalized


def _serialize_value(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, UUID):
        return str(value)
    text = str(value).strip()
    return text or None


def snapshot_emp14(emp: Any) -> dict[str, str | None]:
    out: dict[str, str | None] = {}
    for api_key, attr in EMP14_AUDIT_FIELDS:
        out[api_key] = _serialize_value(getattr(emp, attr, None))
    return out


# Audit actor for status changes made by a scheduler instead of a signed-in user.
SYSTEM_AUDIT_ACTOR: dict[str, Any] = {"firstName": "System", "system": True}
SYSTEM_AUDIT_ROLE = "System"


def actor_display_name(actor: dict[str, Any] | None) -> str | None:
    if not actor:
        return None
    name = f"{actor.get('firstName', '')} {actor.get('lastName', '')}".strip()
    if name:
        return name
    email = actor.get("emailId")
    return str(email).strip() if email else None


def build_audit_rows(
    *,
    employee_id: UUID,
    before: dict[str, str | None],
    after: dict[str, str | None],
    actor: dict[str, Any] | None,
    reason: str | None = None,
) -> list[dict[str, Any]]:
    now = datetime.now(timezone.utc)
    changed_by = actor_display_name(actor)
    actor_id = None
    if actor and actor.get("employeeId"):
        actor_id = str(actor.get("employeeId"))
    if actor and actor.get("system"):
        role = SYSTEM_AUDIT_ROLE
    else:
        role = actor_role(actor) if actor else None
    reason_text = (reason or "").strip() or None
    rows: list[dict[str, Any]] = []
    # Union of keys so newly introduced fields still audit when only on one side.
    fields = set(before) | set(after)
    for field in sorted(fields):
        old = before.get(field)
        new = after.get(field)
        if old == new:
            continue
        rows.append(
            {
                "employee_id": employee_id,
                "field_name": field,
                "old_value": old,
                "new_value": new,
                "changed_by": changed_by,
                "changed_by_id": actor_id,
                "changed_by_role": role,
                "reason": reason_text,
                "changed_at": now,
            }
        )
    return rows
