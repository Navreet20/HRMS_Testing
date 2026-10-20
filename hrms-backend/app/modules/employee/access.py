"""Server-side view/edit gates mirroring UI Phase 2 selectors.

View: EMPLOYEE → self only (unless Employees grant); staff → viewAccess ||
      fullAccess (hierarchy ignored).
Edit: EMPLOYEE → self only (unless Employees full_access grant); staff →
      editAccess || fullAccess + hierarchy (targetRank < actorRank blocked).
      HR bypasses hierarchy (may manage any role).

DATA-8: Active Employees module grants elevate JWT EMPLOYEE to staff
directory rights without changing Role.
"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.roles import normalize_role_key, session_access_role
from app.models.tables import Employee

# Matches hrms-frontend/src/modules/employees/constants.ts DEFAULT_HIERARCHY.
# Live HRMS may override ranks via APPLICATION_CONFIG (type=HIERARCHY); that table
# is not in the 37-table schema, so we use the UI defaults only.
DEFAULT_HIERARCHY: dict[str, int] = {
    "SUPERADMIN": 1,
    "ADMIN": 3,
    "HR": 4,
    "ONBOARDING": 4,
    "ACCOUNTANT": 5,
    "IMMIGRATION": 5,
    "EMPLOYEE": 9,
}


def actor_role(claims: dict[str, Any]) -> str:
    return session_access_role(claims) or "EMPLOYEE"


def actor_employee_id(claims: dict[str, Any]) -> str | None:
    raw = claims.get("employeeId")
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    return None


def _flag(claims: dict[str, Any], key: str) -> bool:
    return bool(claims.get(key))


def target_role_key(emp: Employee) -> str:
    for value in (emp.role, emp.department):
        if isinstance(value, str) and value.strip():
            return normalize_role_key(value)
    return "EMPLOYEE"


async def load_hierarchy(session: AsyncSession) -> dict[str, int]:
    _ = session  # reserved if a future config table stores hierarchy overrides
    return dict(DEFAULT_HIERARCHY)


def hierarchy_rank(hierarchy: dict[str, int], role_key: str) -> int:
    return hierarchy.get(role_key, 10**9)


def bypasses_hierarchy_management(role: str) -> bool:
    """HR may manage any employee regardless of hierarchy rank."""
    return role == "HR"


async def actor_employees_grant_level(
    session: AsyncSession, claims: dict[str, Any]
) -> str | None:
    """Active Employees module grant level for the actor, if any."""
    from app.core.bootstrap_admin import is_superadmin_view
    from app.modules.rbac.access import (
        MODULE_KEY_EMPLOYEES,
        resolve_module_access_level,
    )
    from app.modules.rbac.grants import ACCESS_LEVEL_FULL_ACCESS

    if is_superadmin_view(claims):
        return ACCESS_LEVEL_FULL_ACCESS
    raw_id = actor_employee_id(claims)
    if not raw_id:
        return None
    try:
        employee_id = uuid.UUID(raw_id)
    except (TypeError, ValueError):
        return None
    return await resolve_module_access_level(
        session,
        employee_id=employee_id,
        module_key=MODULE_KEY_EMPLOYEES,
    )


def can_view_employee(
    claims: dict[str, Any],
    target: Employee,
    hierarchy: dict[str, int] | None = None,
    *,
    employees_grant_level: str | None = None,
) -> bool:
    _ = hierarchy  # viewing ignores hierarchy (UI Phase 2)
    role = actor_role(claims)
    if actor_employee_id(claims) == str(target.employee_id):
        return True
    from app.modules.rbac.access import level_meets_minimum
    from app.modules.rbac.grants import ACCESS_LEVEL_READ_ONLY

    if level_meets_minimum(employees_grant_level, ACCESS_LEVEL_READ_ONLY):
        return True
    if role == "EMPLOYEE":
        return False
    return _flag(claims, "viewAccess") or _flag(claims, "fullAccess")


def can_edit_employee(
    claims: dict[str, Any],
    target: Employee,
    hierarchy: dict[str, int],
    *,
    employees_grant_level: str | None = None,
) -> bool:
    role = actor_role(claims)
    is_self = actor_employee_id(claims) == str(target.employee_id)
    from app.modules.rbac.access import level_meets_minimum
    from app.modules.rbac.grants import ACCESS_LEVEL_FULL_ACCESS

    grant_elevated = level_meets_minimum(
        employees_grant_level, ACCESS_LEVEL_FULL_ACCESS
    )
    if role == "EMPLOYEE" and not grant_elevated:
        return is_self
    if not grant_elevated and not (
        _flag(claims, "editAccess") or _flag(claims, "fullAccess")
    ):
        return False
    if is_self:
        return True
    effective_role = "ADMIN" if grant_elevated and role == "EMPLOYEE" else role
    if bypasses_hierarchy_management(effective_role):
        return True
    actor_rank = hierarchy_rank(hierarchy, effective_role)
    target_rank = hierarchy_rank(hierarchy, target_role_key(target))
    # Lower numeric rank = higher privilege; blocked when target outranks actor.
    return not (target_rank < actor_rank)


def can_manage_avatar(
    claims: dict[str, Any],
    target: Employee,
    hierarchy: dict[str, int],
    *,
    employees_grant_level: str | None = None,
) -> bool:
    """Own profile photo is always self-service; otherwise same as edit."""
    if actor_employee_id(claims) == str(target.employee_id):
        return True
    return can_edit_employee(
        claims,
        target,
        hierarchy,
        employees_grant_level=employees_grant_level,
    )


def can_view_full_national_id(
    claims: dict[str, Any] | None,
    employee_id: str,
    *,
    employees_grant_level: str | None = None,
) -> bool:
    """Decrypt national ID for HR/ADMIN (never SELF)."""
    if not claims:
        return False
    from app.modules.employee.field_permissions import can_view_full_national_id_for_role
    from app.modules.rbac.access import level_meets_minimum
    from app.modules.rbac.grants import ACCESS_LEVEL_FULL_ACCESS

    # Full value is role-gated only — self and HR receive last4 via serialize.
    _ = employee_id
    role = actor_role(claims)
    if level_meets_minimum(employees_grant_level, ACCESS_LEVEL_FULL_ACCESS):
        role = "ADMIN"
    return can_view_full_national_id_for_role(
        role,
        is_self=False,
    )


async def get_employee_or_404(session: AsyncSession, employee_id: uuid.UUID) -> Employee:
    result = await session.execute(select(Employee).where(Employee.employee_id == employee_id))
    emp = result.scalar_one_or_none()
    if emp is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    return emp


async def check_can_view_employee(
    session: AsyncSession,
    claims: dict[str, Any],
    emp: Employee,
) -> str | None:
    """403 unless the actor may view ``emp``; returns the actor's Employees grant level.

    Viewing ignores the role hierarchy, so it is not loaded here.
    """
    grant_level = await actor_employees_grant_level(session, claims)
    if not can_view_employee(claims, emp, employees_grant_level=grant_level):
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions to view this employee",
        )
    return grant_level


async def assert_can_view_employee(
    session: AsyncSession,
    claims: dict[str, Any],
    employee_id: uuid.UUID,
) -> Employee:
    emp = await get_employee_or_404(session, employee_id)
    await check_can_view_employee(session, claims, emp)
    return emp


async def assert_can_edit_employee(
    session: AsyncSession,
    claims: dict[str, Any],
    employee_id: uuid.UUID,
) -> Employee:
    emp = await get_employee_or_404(session, employee_id)
    hierarchy = await load_hierarchy(session)
    grant_level = await actor_employees_grant_level(session, claims)
    if not can_edit_employee(
        claims, emp, hierarchy, employees_grant_level=grant_level
    ):
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions to edit this employee",
        )
    return emp


async def assert_can_manage_avatar(
    session: AsyncSession,
    claims: dict[str, Any],
    employee_id: uuid.UUID,
) -> Employee:
    emp = await get_employee_or_404(session, employee_id)
    hierarchy = await load_hierarchy(session)
    grant_level = await actor_employees_grant_level(session, claims)
    if not can_manage_avatar(
        claims, emp, hierarchy, employees_grant_level=grant_level
    ):
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions to manage this profile photo",
        )
    return emp
