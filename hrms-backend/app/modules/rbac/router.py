"""RBAC HTTP routes — catalog (DATA-1), grants upsert (DATA-2), edit/revoke (DATA-6)."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.dependencies import CurrentUser
from app.modules.deps import DbSession
from app.modules.employee.access import actor_role
from app.modules.rbac import grants as grant_svc
from app.modules.rbac import service as svc
from app.modules.rbac.access import MODULE_KEY_COMPANY_SETUP, require_module_access
from app.modules.rbac.catalog import SUBMODULE_KEY_RBAC
from app.modules.rbac.grants import ACCESS_LEVEL_FULL_ACCESS, ACCESS_LEVEL_READ_ONLY

router = APIRouter(prefix="/rbac", tags=["RBAC"])

# DATA-8: Manage Access is grant-only — Company Setup → RBAC full_access
# (read_only can list catalog/grants; mutations require full_access).
_rbac_read = require_module_access(
    MODULE_KEY_COMPANY_SETUP,
    submodule_key=SUBMODULE_KEY_RBAC,
    min_level=ACCESS_LEVEL_READ_ONLY,
    detail="You do not have access to RBAC. Ask an admin for Company Setup → RBAC access.",
)
_rbac_write = require_module_access(
    MODULE_KEY_COMPANY_SETUP,
    submodule_key=SUBMODULE_KEY_RBAC,
    min_level=ACCESS_LEVEL_FULL_ACCESS,
    detail="You do not have access to RBAC. Ask an admin for Company Setup → RBAC full access.",
)


def _persona_roles(user: dict[str, Any]) -> tuple[str, ...] | None:
    return grant_svc.manage_access_target_roles(actor_role(user))


def _persona_exclude_roles(user: dict[str, Any]) -> tuple[str, ...]:
    return grant_svc.manage_access_exclude_roles(actor_role(user))


@router.get("/modules", dependencies=[Depends(_rbac_read)])
async def list_modules(db: DbSession) -> list[dict]:
    """Active modules and Active submodules for Manage Access (read-only)."""
    return await svc.list_active_modules(db)


@router.get("/employees", dependencies=[Depends(_rbac_read)])
async def list_directory(
    db: DbSession,
    user: CurrentUser,
    q: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, alias="pageSize", ge=1, le=50),
) -> dict:
    """Paginated directory of active employees scoped to the actor persona."""
    return await grant_svc.list_directory_employees(
        db,
        q=q,
        roles=_persona_roles(user),
        exclude_roles=_persona_exclude_roles(user),
        page=page,
        page_size=page_size,
    )


@router.get("/employees/search", dependencies=[Depends(_rbac_read)])
async def search_employees(
    db: DbSession,
    user: CurrentUser,
    email: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=50),
) -> list[dict]:
    """Search active employees by email (case-insensitive contains) for Manage Access."""
    return await grant_svc.search_employees_by_email(
        db,
        email=email,
        limit=limit,
        roles=_persona_roles(user),
        exclude_roles=_persona_exclude_roles(user),
    )


@router.get(
    "/employees/{employee_id}/grants",
    dependencies=[Depends(_rbac_read)],
)
async def list_grants(
    employee_id: uuid.UUID,
    db: DbSession,
    user: CurrentUser,
    include_revoked: bool = Query(False, alias="includeRevoked"),
) -> list[dict]:
    """List grants for an employee (Active by default; optional Revoked history)."""
    return await grant_svc.list_employee_grants(
        db,
        employee_id=employee_id,
        include_revoked=include_revoked,
        actor_role_name=actor_role(user),
    )


@router.put(
    "/employees/{employee_id}/grants",
    dependencies=[Depends(_rbac_write)],
)
async def upsert_grants(
    employee_id: uuid.UUID,
    body: dict[str, Any],
    db: DbSession,
    user: CurrentUser,
) -> list[dict]:
    """Upsert Active grants for one module (flat or selected submodules)."""
    return await grant_svc.upsert_employee_grants(
        db,
        employee_id=employee_id,
        payload=body,
        granted_by=grant_svc.actor_employee_id(user),
        actor=user,
    )


@router.put(
    "/employees/{employee_id}/access",
    dependencies=[Depends(_rbac_write)],
)
async def replace_access(
    employee_id: uuid.UUID,
    body: dict[str, Any],
    db: DbSession,
    user: CurrentUser,
) -> list[dict]:
    """Save the Assign access dialog: ``{grants: [{moduleId, submoduleId?, accessLevel}]}``.

    The listed rows become the employee's complete Active grant set.
    """
    return await grant_svc.replace_employee_grants(
        db,
        employee_id=employee_id,
        payload=body,
        granted_by=grant_svc.actor_employee_id(user),
        actor=user,
    )


@router.patch(
    "/employees/{employee_id}/grants/{grant_id}",
    dependencies=[Depends(_rbac_write)],
)
async def patch_grant(
    employee_id: uuid.UUID,
    grant_id: uuid.UUID,
    body: dict[str, Any],
    db: DbSession,
    user: CurrentUser,
) -> dict:
    """Update access_level on an Active grant (RBAC-DATA-6)."""
    return await grant_svc.update_grant_access_level(
        db,
        employee_id=employee_id,
        grant_id=grant_id,
        access_level=str(body.get("accessLevel") or ""),
        granted_by=grant_svc.actor_employee_id(user),
        actor=user,
    )


@router.post(
    "/employees/{employee_id}/grants/{grant_id}/revoke",
    dependencies=[Depends(_rbac_write)],
)
async def revoke_grant_route(
    employee_id: uuid.UUID,
    grant_id: uuid.UUID,
    db: DbSession,
    user: CurrentUser,
) -> dict:
    """Soft-revoke a grant (status=Revoked). History retained."""
    return await grant_svc.revoke_grant(
        db,
        employee_id=employee_id,
        grant_id=grant_id,
        granted_by=grant_svc.actor_employee_id(user),
        actor=user,
    )
