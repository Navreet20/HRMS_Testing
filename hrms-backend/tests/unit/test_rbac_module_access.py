"""RBAC-DATA-4: require_module_access grant vs legacy cutover."""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.core.roles import Role
from app.modules.rbac.access import (
    MODULE_KEY_CUSTOMERS,
    matching_grant_level,
    require_module_access,
)
from app.modules.rbac.grants import ACCESS_LEVEL_FULL_ACCESS, ACCESS_LEVEL_READ_ONLY


def test_matching_grant_level_prefers_full_access() -> None:
    grants = [
        {"moduleKey": "customers", "accessLevel": "read_only"},
        {"moduleKey": "customers", "accessLevel": "full_access"},
    ]
    assert (
        matching_grant_level(grants, module_key="customers")
        == ACCESS_LEVEL_FULL_ACCESS
    )


def test_matching_grant_level_submodule_or_flat() -> None:
    assert (
        matching_grant_level(
            [{"moduleKey": "employees", "accessLevel": "read_only"}],
            module_key="employees",
            submodule_key="onboarding",
        )
        == ACCESS_LEVEL_READ_ONLY
    )
    assert (
        matching_grant_level(
            [
                {
                    "moduleKey": "employees",
                    "submoduleKey": "onboarding",
                    "accessLevel": "full_access",
                }
            ],
            module_key="employees",
            submodule_key="onboarding",
        )
        == ACCESS_LEVEL_FULL_ACCESS
    )
    assert (
        matching_grant_level(
            [
                {
                    "moduleKey": "employees",
                    "submoduleKey": "manage",
                    "accessLevel": "full_access",
                }
            ],
            module_key="employees",
            submodule_key="onboarding",
        )
        is None
    )


@pytest.mark.asyncio
async def test_require_module_access_read_only_blocks_write(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    employee_id = uuid.uuid4()
    user = {
        "employeeId": str(employee_id),
        "role": "HR",
        "department": "HR",
    }
    checker = require_module_access(
        MODULE_KEY_CUSTOMERS,
        min_level=ACCESS_LEVEL_FULL_ACCESS,
        legacy_roles=(Role.SUPERADMIN, Role.HR),
    )

    async def fake_resolve(db, *, employee_id, module_key, submodule_key=None, claims=None):
        return ACCESS_LEVEL_READ_ONLY

    monkeypatch.setattr(
        "app.modules.rbac.access.resolve_module_access_level",
        fake_resolve,
    )
    monkeypatch.setattr(
        "app.modules.rbac.access.get_settings",
        lambda: SimpleNamespace(auth_bypass=False),
    )

    with pytest.raises(HTTPException) as exc:
        await checker(user, db=AsyncMock())
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_require_module_access_legacy_when_no_grant(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    employee_id = uuid.uuid4()
    user = {
        "employeeId": str(employee_id),
        "role": "HR",
        "department": "HR",
    }
    checker = require_module_access(
        MODULE_KEY_CUSTOMERS,
        min_level=ACCESS_LEVEL_FULL_ACCESS,
        legacy_roles=(Role.SUPERADMIN, Role.HR),
    )

    async def fake_resolve(db, *, employee_id, module_key, submodule_key=None, claims=None):
        return None

    monkeypatch.setattr(
        "app.modules.rbac.access.resolve_module_access_level",
        fake_resolve,
    )
    monkeypatch.setattr(
        "app.modules.rbac.access.get_settings",
        lambda: SimpleNamespace(auth_bypass=False),
    )

    out = await checker(user, db=AsyncMock())
    assert out is user


@pytest.mark.asyncio
async def test_require_module_access_no_grant_no_legacy_403(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    employee_id = uuid.uuid4()
    user = {
        "employeeId": str(employee_id),
        "role": "EMPLOYEE",
        "department": "EMPLOYEE",
    }
    checker = require_module_access(
        MODULE_KEY_CUSTOMERS,
        min_level=ACCESS_LEVEL_READ_ONLY,
        legacy_roles=(Role.SUPERADMIN, Role.HR),
    )

    async def fake_resolve(db, *, employee_id, module_key, submodule_key=None, claims=None):
        return None

    monkeypatch.setattr(
        "app.modules.rbac.access.resolve_module_access_level",
        fake_resolve,
    )
    monkeypatch.setattr(
        "app.modules.rbac.access.get_settings",
        lambda: SimpleNamespace(auth_bypass=False),
    )

    with pytest.raises(HTTPException) as exc:
        await checker(user, db=AsyncMock())
    assert exc.value.status_code == 403
