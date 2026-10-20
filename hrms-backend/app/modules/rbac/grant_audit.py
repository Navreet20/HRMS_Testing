"""Access-grant audit (RBAC-DATA-9), stored in the shared ``activity_log`` (no separate audit table).

Each grant change is one row: ``entity_type='employee'``, ``entity_id`` = the employee who got / lost access,
``action`` = access_granted | access_changed | access_revoked, ``details`` = grant_id, module_key, submodule_key,
access_level, previous_access_level. Written in the same transaction as the grant insert / revoke.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.activity_writer import write_log
from app.models.activity_log import ActivityLog
from app.models.tables import Employee, EmployeeAccessGrant, Module, Submodule

AUDIT_ACTION_CREATED = "created"
AUDIT_ACTION_UPDATED = "updated"
AUDIT_ACTION_REVOKED = "revoked"

FIELD_NAME_ACCESS_GRANT = "accessGrant"

_LOG_ACTION = {
    AUDIT_ACTION_CREATED: "access_granted",
    AUDIT_ACTION_UPDATED: "access_changed",
    AUDIT_ACTION_REVOKED: "access_revoked",
}
_ACTION_SUFFIX = {
    "access_granted": "granted",
    "access_changed": "updated",
    "access_revoked": "revoked",
}


def _employee_display_name(emp: Employee) -> str:
    return (
        f"{getattr(emp, 'first_name', None) or ''} "
        f"{getattr(emp, 'last_name', None) or ''}"
    ).strip() or "—"


def _scope_label(
    *,
    module_name: str | None,
    submodule_name: str | None,
    access_level: str | None,
) -> str:
    scope = (module_name or "").strip() or "Module"
    sub = (submodule_name or "").strip()
    if sub:
        scope = f"{scope} → {sub}"
    level = (access_level or "").strip()
    if level:
        return f"{scope} · {level}"
    return scope


def _actor_uuid(actor: dict[str, Any] | None) -> uuid.UUID | None:
    if not actor:
        return None
    raw = actor.get("employeeId") or actor.get("id")
    if not raw:
        return None
    try:
        return uuid.UUID(str(raw))
    except (TypeError, ValueError):
        return None


async def record_grant_audit(
    db: AsyncSession,
    *,
    action: str,
    grant: EmployeeAccessGrant,
    target: Employee,
    actor: dict[str, Any] | None = None,
    previous_access_level: str | None = None,
) -> ActivityLog:
    """Append one activity_log row for a grant change (never updated / deleted: the table is append-only)."""
    module = await db.get(Module, grant.module_id)
    submodule = await db.get(Submodule, grant.submodule_id) if grant.submodule_id is not None else None
    details: dict[str, Any] = {
        "grant_id": str(grant.id),
        "module_key": module.module_key if module is not None else None,
        "access_level": grant.access_level,
    }
    if submodule is not None:
        details["submodule_key"] = submodule.submodule_key
    if previous_access_level:
        details["previous_access_level"] = previous_access_level
    row = await write_log(
        db,
        action=_LOG_ACTION.get(action, action),
        entity_type="employee",
        entity_id=target.id,
        actor_employee_id=_actor_uuid(actor),
        details=details,
    )
    await db.flush()
    return row


def _utc_day_start(day: date) -> datetime:
    return datetime.combine(day, time.min, tzinfo=timezone.utc)


def _trail_item(
    row: ActivityLog,
    target: Employee | None,
    names: dict[str, str],
    actor: Employee | None,
) -> dict[str, Any]:
    d = row.details or {}
    module_name = names.get(f"m:{d.get('module_key')}", d.get("module_key"))
    sub_name = names.get(f"s:{d.get('submodule_key')}") if d.get("submodule_key") else None
    new_scope = _scope_label(
        module_name=module_name, submodule_name=sub_name, access_level=d.get("access_level")
    )
    suffix = _ACTION_SUFFIX.get(row.action, row.action)
    if row.action == "access_revoked":
        old_value, new_value = new_scope, "Revoked"
    elif row.action == "access_changed" and d.get("previous_access_level"):
        old_value = _scope_label(
            module_name=module_name,
            submodule_name=sub_name,
            access_level=d.get("previous_access_level"),
        )
        new_value = f"{new_scope} ({suffix})"
    else:
        old_value, new_value = None, f"{new_scope} ({suffix})"
    return {
        "id": str(row.id),
        "employeeId": str(row.entity_id),
        "employeeCode": (getattr(target, "employee_code", None) or None) if target else None,
        "businessEmployeeId": (getattr(target, "emp_id", None) or None) if target else None,
        "employeeName": _employee_display_name(target) if target else "—",
        "fieldName": FIELD_NAME_ACCESS_GRANT,
        "oldValue": old_value,
        "newValue": new_value,
        "changedBy": _employee_display_name(actor) if actor else None,
        "changedById": str(row.actor_employee_id) if row.actor_employee_id else None,
        "changedByRole": (actor.role if actor else None),
        "changedAt": row.occurred_at.isoformat() if row.occurred_at else None,
    }


async def list_grant_audit_as_trail(
    session: AsyncSession,
    *,
    employee_id: uuid.UUID | None = None,
    q: str | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    fetch_limit: int | None = None,
) -> tuple[int, list[dict[str, Any]]]:
    """Grant changes from activity_log, shaped like profile field audit items."""
    cond = [
        ActivityLog.entity_type == "employee",
        ActivityLog.action.in_(tuple(_ACTION_SUFFIX)),
    ]
    if employee_id is not None:
        cond.append(ActivityLog.entity_id == employee_id)
    range_start, range_end = from_date, to_date
    if range_start and range_end and range_start > range_end:
        range_start, range_end = range_end, range_start
    if range_start is not None:
        cond.append(ActivityLog.occurred_at >= _utc_day_start(range_start))
    if range_end is not None:
        cond.append(
            ActivityLog.occurred_at < _utc_day_start(range_end) + timedelta(days=1)
        )
    needle = (q or "").strip()
    base = (
        select(ActivityLog)
        .join(Employee, Employee.id == ActivityLog.entity_id)
        .where(*cond)
        # Hide rows whose target is a system account.
        .where(
            (Employee.is_system_account.is_(False))
            | (Employee.is_system_account.is_(None))
        )
    )
    if needle:
        pattern = f"{needle}%"
        base = base.where(
            Employee.first_name.ilike(pattern)
            | Employee.last_name.ilike(pattern)
            | func.concat(Employee.first_name, " ", Employee.last_name).ilike(pattern)
            | Employee.employee_code.ilike(pattern)
            | Employee.emp_id.ilike(pattern)
        )
    total = int(
        (await session.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
        or 0
    )
    stmt = base.order_by(ActivityLog.occurred_at.desc(), ActivityLog.id.desc())
    if fetch_limit is not None:
        stmt = stmt.limit(max(0, fetch_limit))
    rows = (await session.execute(stmt)).scalars().all()

    names: dict[str, str] = {}
    for key, name in (
        await session.execute(select(Module.module_key, Module.display_name))
    ).all():
        names[f"m:{key}"] = name
    for key, name in (
        await session.execute(select(Submodule.submodule_key, Submodule.display_name))
    ).all():
        names[f"s:{key}"] = name
    ids = {r.entity_id for r in rows} | {
        r.actor_employee_id for r in rows if r.actor_employee_id
    }
    people: dict[uuid.UUID, Employee] = {}
    if ids:
        people = {
            e.id: e
            for e in (
                await session.execute(select(Employee).where(Employee.id.in_(ids)))
            ).scalars()
        }
    items = [
        _trail_item(r, people.get(r.entity_id), names, people.get(r.actor_employee_id))
        for r in rows
    ]
    return total, items
