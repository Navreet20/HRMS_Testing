"""RBAC-DATA-8: Manage Access / catalog gates are grant-only."""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.modules.rbac.access import MODULE_KEY_COMPANY_SETUP, require_module_access
from app.modules.rbac.grants import ACCESS_LEVEL_FULL_ACCESS, ACCESS_LEVEL_READ_ONLY


@pytest.mark.asyncio
async def test_manage_access_403_for_admin_role_without_company_setup_grant(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Role.ADMIN alone cannot open Manage Access (DATA-8)."""
    user = {
        "employeeId": str(uuid.uuid4()),
        "role": "ADMIN",
        "department": "ADMIN",
    }
    checker = require_module_access(
        MODULE_KEY_COMPANY_SETUP,
        min_level=ACCESS_LEVEL_FULL_ACCESS,
        detail="You do not have access to RBAC.",
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


@pytest.mark.asyncio
async def test_manage_access_allows_company_setup_full_access(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = {
        "employeeId": str(uuid.uuid4()),
        "role": "EMPLOYEE",
        "department": "EMPLOYEE",
    }
    checker = require_module_access(
        MODULE_KEY_COMPANY_SETUP,
        min_level=ACCESS_LEVEL_FULL_ACCESS,
    )

    async def fake_resolve(db, *, employee_id, module_key, submodule_key=None, claims=None):
        assert module_key == MODULE_KEY_COMPANY_SETUP
        return ACCESS_LEVEL_FULL_ACCESS

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
async def test_manage_access_read_only_cannot_mutate(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = {
        "employeeId": str(uuid.uuid4()),
        "role": "SUPERADMIN",
        "department": "SUPERADMIN",
    }
    checker = require_module_access(
        MODULE_KEY_COMPANY_SETUP,
        min_level=ACCESS_LEVEL_FULL_ACCESS,
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


def test_rbac_router_has_no_legacy_admin_roles() -> None:
    from app.modules.rbac import router as rbac_router

    source = open(rbac_router.__file__, encoding="utf-8").read()
    assert "legacy_roles" not in source
    assert "ADMIN_ROLES" not in source
