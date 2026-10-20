"""Session grants for mocked-DB functional tests.

Catalog APIs authorize from Active ``EmployeeAccessGrant`` rows (RBAC-DATA-4 /
DATA-8), not the JWT role. Functional tests that override ``get_current_user``
with a claims dict and yield a ``MagicMock`` session have no grant rows, so the
``functional`` conftest resolves grants from the claims' role via
``LEGACY_ROLE_GRANTS`` — the access each persona is given in Manage Access.
"""

from __future__ import annotations

import uuid
from typing import Any, Final

from app.core.roles import session_access_role
from app.modules.rbac.access import (
    MODULE_KEY_ASSETS,
    MODULE_KEY_AUDIT_TRAIL,
    MODULE_KEY_COMPANY_SETUP,
    MODULE_KEY_CUSTOMERS,
    MODULE_KEY_EMPLOYEE_PORTAL,
    MODULE_KEY_EMPLOYEES,
    MODULE_KEY_PROJECTS,
    SUBMODULE_KEY_MANAGE,
    SUBMODULE_KEY_SELF,
)
from app.modules.rbac.grants import ACCESS_LEVEL_FULL_ACCESS, ACCESS_LEVEL_READ_ONLY


def _grant(
    module_key: str,
    level: str = ACCESS_LEVEL_FULL_ACCESS,
    submodule_key: str | None = None,
) -> dict[str, Any]:
    row: dict[str, Any] = {"moduleKey": module_key, "accessLevel": level}
    if submodule_key is not None:
        row["submoduleKey"] = submodule_key
    return row


_SELF_SERVICE: Final = (_grant(MODULE_KEY_EMPLOYEE_PORTAL, submodule_key=SUBMODULE_KEY_SELF),)

_CATALOG_FULL: Final = (
    _grant(MODULE_KEY_EMPLOYEES),
    _grant(MODULE_KEY_CUSTOMERS),
    _grant(MODULE_KEY_PROJECTS),
    _grant(MODULE_KEY_ASSETS),
    _grant(MODULE_KEY_AUDIT_TRAIL),
    _grant(MODULE_KEY_COMPANY_SETUP),
    *_SELF_SERVICE,
    _grant(MODULE_KEY_EMPLOYEE_PORTAL, submodule_key=SUBMODULE_KEY_MANAGE),
)

LEGACY_ROLE_GRANTS: Final[dict[str, tuple[dict[str, Any], ...]]] = {
    "SUPERADMIN": _CATALOG_FULL,
    "ADMIN": _CATALOG_FULL,
    "HR": (
        _grant(MODULE_KEY_EMPLOYEES),
        _grant(MODULE_KEY_CUSTOMERS),
        _grant(MODULE_KEY_PROJECTS),
        _grant(MODULE_KEY_ASSETS),
        _grant(MODULE_KEY_AUDIT_TRAIL, ACCESS_LEVEL_READ_ONLY),
        *_SELF_SERVICE,
        _grant(MODULE_KEY_EMPLOYEE_PORTAL, submodule_key=SUBMODULE_KEY_MANAGE),
    ),
    "EMPLOYEE": _SELF_SERVICE,
}

_registry: dict[uuid.UUID, list[dict[str, Any]]] = {}


def _employee_uuid(claims: dict[str, Any]) -> uuid.UUID | None:
    raw = claims.get("employeeId")
    try:
        return uuid.UUID(str(raw)) if raw else None
    except (TypeError, ValueError):
        return None


def register_test_user(claims: dict[str, Any]) -> dict[str, Any]:
    """Give a claims dict the grants of its role for mocked-DB requests.

    Legacy view-only flags (no ``editAccess`` / ``fullAccess``) map to a
    read-only Employees grant.
    """
    employee_id = _employee_uuid(claims)
    role = session_access_role(claims)
    if employee_id is None or not role:
        return claims
    grants = [dict(g) for g in LEGACY_ROLE_GRANTS.get(role, ())]
    view_only = (
        "editAccess" in claims
        and not claims.get("editAccess")
        and not claims.get("fullAccess")
    )
    if view_only:
        for g in grants:
            if g["moduleKey"] == MODULE_KEY_EMPLOYEES:
                g["accessLevel"] = ACCESS_LEVEL_READ_ONLY
    _registry[employee_id] = grants
    return claims


def grants_for(employee_id: uuid.UUID) -> list[dict[str, Any]]:
    return [dict(g) for g in _registry.get(employee_id, ())]


def clear_registry() -> None:
    _registry.clear()
