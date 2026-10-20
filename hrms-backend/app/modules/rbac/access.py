"""RBAC-DATA-4 / DATA-8: enforce Active grant access_level on catalog APIs.

When an Active grant exists for the module (± submodule), its level is
authoritative. AUTH_BYPASS always allows.

DATA-8: Manage Access and catalog mutations are **grant-only** (no
``Role.SUPERADMIN`` / ``Role.ADMIN`` fallback). Optional ``legacy_roles`` remains
only for non-admin picker reads (e.g. org department lists for forms).
"""

from __future__ import annotations

import uuid
from collections.abc import Callable, Sequence
from typing import Any

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.bootstrap_admin import is_superadmin_view
from app.core.config import get_settings
from app.core.roles import Role, session_access_roles
from app.db.session import get_db
from app.dependencies import CurrentUser
from app.modules.rbac.catalog import (
    MODULE_KEY_ASSETS,
    MODULE_KEY_AUDIT_TRAIL,
    MODULE_KEY_COMPANY_SETUP,
    MODULE_KEY_CUSTOMERS,
    MODULE_KEY_DASHBOARD,
    MODULE_KEY_EMPLOYEE_PORTAL,
    MODULE_KEY_EMPLOYEES,
    MODULE_KEY_PROJECTS,
    SESSION_MODULE_KEYS,
    SESSION_SUBMODULE_KEYS,
    SUBMODULE_KEY_MANAGE,
    SUBMODULE_KEY_RBAC,
    SUBMODULE_KEY_SELF,
)
from app.modules.rbac.grants import ACCESS_LEVEL_FULL_ACCESS, ACCESS_LEVEL_READ_ONLY
from app.modules.rbac.session_grants import resolve_session_grants

__all__ = [
    "MODULE_KEY_ASSETS",
    "MODULE_KEY_AUDIT_TRAIL",
    "MODULE_KEY_COMPANY_SETUP",
    "MODULE_KEY_CUSTOMERS",
    "MODULE_KEY_DASHBOARD",
    "MODULE_KEY_EMPLOYEE_PORTAL",
    "MODULE_KEY_EMPLOYEES",
    "MODULE_KEY_PROJECTS",
    "SUBMODULE_KEY_MANAGE",
    "SUBMODULE_KEY_SELF",
    "level_meets_minimum",
    "matching_grant_level",
    "require_audit_trail_access",
    "require_module_access",
    "resolve_module_access_level",
]

ACCESS_LEVEL_RANK: dict[str, int] = {
    ACCESS_LEVEL_READ_ONLY: 1,
    ACCESS_LEVEL_FULL_ACCESS: 2,
}


def _parse_employee_id(user: dict[str, Any]) -> uuid.UUID | None:
    raw = user.get("employeeId") or user.get("id")
    if raw is None:
        return None
    try:
        return uuid.UUID(str(raw))
    except (TypeError, ValueError):
        return None


def matching_grant_level(
    grants: list[dict[str, Any]],
    *,
    module_key: str,
    submodule_key: str | None = None,
) -> str | None:
    """Best Active grant level for module (± submodule), or None if no match."""
    best: str | None = None
    best_rank = 0
    for row in grants:
        if row.get("moduleKey") != module_key:
            continue
        row_sub = row.get("submoduleKey")
        if submodule_key is None:
            # Module-level: any grant on this module (flat or submodule).
            pass
        elif row_sub is not None and row_sub != submodule_key:
            continue
        # submodule requested: allow exact submodule OR flat module grant (no sub).
        level = row.get("accessLevel")
        if not isinstance(level, str):
            continue
        rank = ACCESS_LEVEL_RANK.get(level, 0)
        if rank > best_rank:
            best_rank = rank
            best = level
    return best


def level_meets_minimum(level: str | None, min_level: str) -> bool:
    if level is None:
        return False
    return ACCESS_LEVEL_RANK.get(level, 0) >= ACCESS_LEVEL_RANK.get(min_level, 0)


async def resolve_module_access_level(
    db: AsyncSession,
    *,
    employee_id: uuid.UUID,
    module_key: str,
    submodule_key: str | None = None,
) -> str | None:
    grants = await resolve_session_grants(db, employee_id=employee_id)
    return matching_grant_level(
        grants, module_key=module_key, submodule_key=submodule_key
    )


def require_module_access(
    module_key: str,
    *,
    submodule_key: str | None = None,
    min_level: str = ACCESS_LEVEL_READ_ONLY,
    legacy_roles: Sequence[Role] | None = None,
    detail: str = "Insufficient module access",
) -> Callable[..., Any]:
    """FastAPI dependency: Active grant at ``min_level``, else legacy roles."""

    if min_level not in ACCESS_LEVEL_RANK:
        raise ValueError(f"Invalid min_level: {min_level}")
    # Fails at router import, so a key missing from rbac/catalog.py stops startup.
    if module_key not in SESSION_MODULE_KEYS:
        raise ValueError(f"Unknown RBAC module key: {module_key!r}")
    if submodule_key is not None and submodule_key not in SESSION_SUBMODULE_KEYS:
        raise ValueError(f"Unknown RBAC submodule key: {submodule_key!r}")

    allowed_legacy = {r.value for r in legacy_roles} if legacy_roles else set()

    async def _checker(
        user: CurrentUser,
        db: AsyncSession = Depends(get_db, scope="function"),
    ) -> dict[str, Any]:
        # Superadmin view (allowlisted employee): full access to every module.
        if get_settings().auth_bypass or is_superadmin_view(user):
            return user

        employee_id = _parse_employee_id(user)
        if employee_id is not None:
            level = await resolve_module_access_level(
                db,
                employee_id=employee_id,
                module_key=module_key,
                submodule_key=submodule_key,
            )
            if level is not None:
                if level_meets_minimum(level, min_level):
                    return user
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=detail,
                )

        if allowed_legacy and session_access_roles(user).intersection(allowed_legacy):
            return user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )

    return _checker


def require_audit_trail_access(
    *,
    detail: str = "You do not have access to Audit Trail. Ask an admin for Audit Trail or Company Setup access.",
) -> Callable[..., Any]:
    """DATA-9: Audit Trail read = Audit Trail grant OR Company Setup → RBAC grant."""

    async def _checker(
        user: CurrentUser,
        db: AsyncSession = Depends(get_db, scope="function"),
    ) -> dict[str, Any]:
        if get_settings().auth_bypass or is_superadmin_view(user):
            return user

        employee_id = _parse_employee_id(user)
        if employee_id is not None:
            for module_key, submodule_key in (
                (MODULE_KEY_AUDIT_TRAIL, None),
                (MODULE_KEY_COMPANY_SETUP, SUBMODULE_KEY_RBAC),
            ):
                level = await resolve_module_access_level(
                    db,
                    employee_id=employee_id,
                    module_key=module_key,
                    submodule_key=submodule_key,
                )
                if level_meets_minimum(level, ACCESS_LEVEL_READ_ONLY):
                    return user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )

    return _checker
