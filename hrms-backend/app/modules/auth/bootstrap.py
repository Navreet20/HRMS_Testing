"""One call for everything the shell needs after sign-in."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.bootstrap_admin import is_allowlist_superadmin_claims, is_superadmin_view
from app.core.role_groups import TIMESHEET_ORG_APPROVER_ROLES, TIMESHEET_ROLES
from app.core.roles import session_access_roles
from app.modules.auth.service import AuthService
from app.modules.company import service as company_service
from app.modules.employee.access import actor_employee_id
from app.modules.employee.service import EmployeeService
from app.modules.rbac.access import (
    MODULE_KEY_COMPANY_SETUP,
    MODULE_KEY_EMPLOYEES,
    level_meets_minimum,
    matching_grant_level,
)
from app.modules.rbac.catalog import SUBMODULE_KEY_COMPANY_PROFILE
from app.modules.rbac.grants import ACCESS_LEVEL_READ_ONLY
from app.modules.timesheet import week_service

_auth = AuthService()
_employees = EmployeeService()


def _can_read_company(user: dict[str, Any], grants: list[dict[str, Any]]) -> bool:
    """Same rule as the Company Setup read gate, answered without a 403."""
    if get_settings().auth_bypass or is_superadmin_view(user):
        return True
    level = matching_grant_level(
        grants,
        module_key=MODULE_KEY_COMPANY_SETUP,
        submodule_key=SUBMODULE_KEY_COMPANY_PROFILE,
    )
    if level is not None:
        return level_meets_minimum(level, ACCESS_LEVEL_READ_ONLY)
    legacy = {role.value for role in TIMESHEET_ORG_APPROVER_ROLES}
    return bool(session_access_roles(user).intersection(legacy))


async def bootstrap(session: AsyncSession, user: dict[str, Any]) -> dict[str, Any]:
    """Session, grants, managing option, own profile, company and queue count.

    ``get_current_user`` has already checked the session row, so it is not read
    again here. Parts the caller may not see come back as ``null``.
    Allowlist Superadmins have no employee row: profile / managing option are null.
    """
    if is_allowlist_superadmin_claims(user):
        payload = await _auth.me(session, user)
        grants: list[dict[str, Any]] = payload["userDetails"].get("accessGrants") or []
        payload["managingOption"] = {
            "hasDirectReports": False,
            "canManageProfileUpdates": True,
            "canManageAssetRequests": True,
            "canManageItRequests": True,
            "canManageTimesheets": True,
            "canManageLeaves": True,
        }
        payload["profile"] = None
        payload["company"] = None
        if _can_read_company(user, grants):
            try:
                payload["company"] = await company_service.get_current_company(
                    session, user
                )
            except HTTPException as exc:
                if exc.status_code != status.HTTP_404_NOT_FOUND:
                    raise
        # No employeeId: queue badge is org-wide (or 0 on a fresh DB), not "my reports".
        allowed_roles = {role.value for role in TIMESHEET_ROLES}
        if session_access_roles(user).intersection(allowed_roles):
            payload["queueCount"] = await week_service.count_waiting(session, user)
        else:
            payload["queueCount"] = None
        return payload

    raw_id = actor_employee_id(user)
    try:
        employee_id = uuid.UUID(str(raw_id))
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        ) from exc
    try:
        employee = await _employees._get(session, employee_id)
    except HTTPException as exc:
        if exc.status_code == status.HTTP_404_NOT_FOUND:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Account not found"
            ) from exc
        raise

    payload = await _auth.me(session, user, employee=employee)
    grants = payload["userDetails"].get("accessGrants") or []
    employees_level = matching_grant_level(grants, module_key=MODULE_KEY_EMPLOYEES)

    payload["managingOption"] = await _employees.managing_option(session, user)
    payload["profile"] = await _employees._profile_dict(
        session, employee, actor=user, employees_grant_level=employees_level
    )
    payload["company"] = None
    if _can_read_company(user, grants):
        try:
            payload["company"] = await company_service.get_current_company(
                session, user
            )
        except HTTPException as exc:
            if exc.status_code != status.HTTP_404_NOT_FOUND:
                raise
    # Same number the nav badge showed when it downloaded the whole queue.
    allowed_roles = {role.value for role in TIMESHEET_ROLES}
    payload["queueCount"] = (
        await week_service.count_waiting(session, user)
        if session_access_roles(user).intersection(allowed_roles)
        else None
    )
    return payload
