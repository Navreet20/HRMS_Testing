"""Resolve session accessGrants (RBAC-DATA-5).

``resolve_session_grants`` is the only entry point. It combines stored grants
from the configured source (``RBAC_GRANT_SOURCE``) with the derived Employee
Portal grants, and returns ``{ moduleKey, submoduleKey?, accessLevel }`` rows
consumed by ``require_module_access`` and ``/auth/me``.
"""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable
from typing import Any, Final

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.roles import Status
from app.models.tables import Employee, EmployeeAccessGrant, RbacModule, RbacSubmodule
from app.modules.employee.status import EMPLOYEE_INACTIVE_ALIASES
from app.modules.rbac.catalog import (
    MODULE_KEY_DASHBOARD,
    MODULE_KEY_EMPLOYEE_PORTAL,
    SESSION_MODULE_KEYS,
    SESSION_SUBMODULE_KEYS,
    SUBMODULE_KEY_MANAGE,
    SUBMODULE_KEY_SELF,
)
from app.modules.rbac.service import MASTER_STATUS_ACTIVE
from app.modules.rbac.grants import (
    ACCESS_LEVEL_FULL_ACCESS,
    ACCESS_LEVEL_READ_ONLY,
    from_db_level,
)

# Drafts and inactive employees do not make their manager a "Manage" user.
_NON_REPORT_STATUSES: Final = sorted({Status.NEW.value, "DRAFT", *EMPLOYEE_INACTIVE_ALIASES})


async def full_catalog_session_grants(db: AsyncSession) -> list[dict[str, Any]]:
    """Every Active module in the RBAC catalog table at full_access (Superadmin view).

    Read from the database, so a module added to the catalog reaches Superadmins
    without a code change. Employee Portal is not in the catalog (it is derived),
    so its Self and Manage rows are added here. A catalog row with no known key
    is skipped, the same as for stored grants.
    """
    result = await db.execute(
        select(RbacModule.module_key, RbacModule.is_active).order_by(
            RbacModule.display_order, RbacModule.id
        )
    )
    out: list[dict[str, Any]] = []
    for module_key, is_active in result.all():
        if module_key and is_active is not False:
            out.append({"moduleKey": module_key, "accessLevel": ACCESS_LEVEL_FULL_ACCESS})
    # "dashboard" is a nav-only module with no row in the 37-table catalog.
    out.append({"moduleKey": MODULE_KEY_DASHBOARD, "accessLevel": ACCESS_LEVEL_FULL_ACCESS})
    for sub in (SUBMODULE_KEY_SELF, SUBMODULE_KEY_MANAGE):
        out.append(
            {
                "moduleKey": MODULE_KEY_EMPLOYEE_PORTAL,
                "submoduleKey": sub,
                "accessLevel": ACCESS_LEVEL_FULL_ACCESS,
            }
        )
    return out


_ACCESS_LEVEL_RANK: Final[dict[str, int]] = {
    ACCESS_LEVEL_READ_ONLY: 1,
    ACCESS_LEVEL_FULL_ACCESS: 2,
}


GrantSource = Callable[..., Awaitable[list[dict[str, Any]]]]


async def resolve_session_grants(
    db: AsyncSession,
    *,
    employee_id: uuid.UUID,
) -> list[dict[str, Any]]:
    """Session grants for ``employee_id``: stored grants + derived Employee Portal.

    Employee Portal is derived, not granted: Self is always present, and
    Manage is present while any non-inactive employee reports to this one.
    """
    source = _GRANT_SOURCES[get_settings().rbac_grant_source]
    out = await source(db, employee_id=employee_id)
    out.extend(await _derived_employee_portal_grants(db, employee_id=employee_id))
    return out


async def _db_grants(
    db: AsyncSession,
    *,
    employee_id: uuid.UUID,
) -> list[dict[str, Any]]:
    """Active ``EMPLOYEE_ACCESS_GRANT`` rows mapped to catalog keys.

    Uses an explicit JOIN (not relationship lazy-load) so async sessions never
    drop grants with MissingGreenlet when serializing /auth/me.

    Grants are strictly scoped to ``employee_id`` — a grant on
    ``user@cognivance.com`` never applies to a different employee row such as
    ``user@arohak.com``. Rows for modules outside the catalog (e.g. legacy
    Employee Portal) are ignored.
    """
    result = await db.execute(
        select(
            EmployeeAccessGrant.access_level,
            RbacModule.module_key,
            RbacSubmodule.submodule_key,
        )
        .join(RbacModule, RbacModule.id == EmployeeAccessGrant.module_id)
        .outerjoin(
            RbacSubmodule,
            RbacSubmodule.id == EmployeeAccessGrant.submodule_id,
        )
        .where(
            EmployeeAccessGrant.employee_id == employee_id,
            EmployeeAccessGrant.revoked_at.is_(None),
        )
        .order_by(
            EmployeeAccessGrant.module_id,
            EmployeeAccessGrant.submodule_id.nullsfirst(),
        )
    )
    out: list[dict[str, Any]] = []
    for access_level, module_key, submodule_key in result.all():
        if not module_key or module_key not in SESSION_MODULE_KEYS:
            continue
        level = from_db_level(access_level)
        if level not in _ACCESS_LEVEL_RANK:
            continue
        entry: dict[str, Any] = {"moduleKey": module_key, "accessLevel": level}
        if submodule_key and submodule_key in SESSION_SUBMODULE_KEYS:
            entry["submoduleKey"] = submodule_key
        out.append(entry)
    return out


_GRANT_SOURCES: Final[dict[str, GrantSource]] = {
    "db": _db_grants,
}


async def has_direct_reports(db: AsyncSession, *, employee_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(Employee.employee_id)
        .where(
            Employee.reporting_manager_id == employee_id,
            Employee.employee_id != employee_id,
            Employee.status.is_(None)
            | ~func.upper(Employee.status).in_(_NON_REPORT_STATUSES),
        )
        .limit(1)
    )
    return result.first() is not None


async def _derived_employee_portal_grants(
    db: AsyncSession,
    *,
    employee_id: uuid.UUID,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = [
        {
            "moduleKey": MODULE_KEY_EMPLOYEE_PORTAL,
            "submoduleKey": SUBMODULE_KEY_SELF,
            "accessLevel": ACCESS_LEVEL_FULL_ACCESS,
        }
    ]
    if await has_direct_reports(db, employee_id=employee_id):
        out.append(
            {
                "moduleKey": MODULE_KEY_EMPLOYEE_PORTAL,
                "submoduleKey": SUBMODULE_KEY_MANAGE,
                "accessLevel": ACCESS_LEVEL_FULL_ACCESS,
            }
        )
    return out
