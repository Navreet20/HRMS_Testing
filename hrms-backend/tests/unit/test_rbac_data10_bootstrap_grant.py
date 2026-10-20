"""RBAC-DATA-10: bootstrap Super Admin Company Setup full_access grant."""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.rbac.catalog import MODULE_COMPANY_SETUP
from app.modules.rbac.default_grants import ensure_bootstrap_company_setup_grant
from app.modules.rbac.grants import ACCESS_LEVEL_FULL_ACCESS
from app.modules.rbac.service import MASTER_STATUS_ACTIVE


@pytest.mark.asyncio
async def test_ensure_bootstrap_company_setup_grant_covers_every_active_submodule() -> None:
    employee_id = uuid.uuid4()
    module = SimpleNamespace(
        module_id=8,
        module_name=MODULE_COMPANY_SETUP,
        status=MASTER_STATUS_ACTIVE,
        has_submodules=True,
        submodules=[
            SimpleNamespace(submodule_id=11, status=MASTER_STATUS_ACTIVE),
            SimpleNamespace(submodule_id=12, status="Inactive"),
            SimpleNamespace(submodule_id=13, status=MASTER_STATUS_ACTIVE),
        ],
    )
    result = MagicMock()
    result.scalar_one_or_none.return_value = module
    session = AsyncMock(spec=AsyncSession)
    session.execute = AsyncMock(return_value=result)

    with patch(
        "app.modules.rbac.default_grants.upsert_employee_grants",
        new_callable=AsyncMock,
    ) as upsert:
        upsert.return_value = [
            {
                "moduleId": 8,
                "moduleName": MODULE_COMPANY_SETUP,
                "accessLevel": ACCESS_LEVEL_FULL_ACCESS,
                "submoduleId": None,
            }
        ]
        ok = await ensure_bootstrap_company_setup_grant(
            session, employee_id=employee_id
        )

    assert ok is True
    upsert.assert_awaited_once()
    kwargs = upsert.await_args.kwargs
    assert kwargs["employee_id"] == employee_id
    assert kwargs["granted_by"] == employee_id
    assert kwargs["payload"] == {
        "moduleId": 8,
        "accessLevel": ACCESS_LEVEL_FULL_ACCESS,
        "submoduleIds": [11, 13],
    }


@pytest.mark.asyncio
async def test_ensure_bootstrap_company_setup_grant_idempotent_via_upsert() -> None:
    employee_id = uuid.uuid4()
    module = SimpleNamespace(
        module_id=8,
        module_name=MODULE_COMPANY_SETUP,
        status=MASTER_STATUS_ACTIVE,
        has_submodules=False,
    )
    result = MagicMock()
    result.scalar_one_or_none.return_value = module
    session = AsyncMock(spec=AsyncSession)
    session.execute = AsyncMock(return_value=result)

    with patch(
        "app.modules.rbac.default_grants.upsert_employee_grants",
        new_callable=AsyncMock,
    ) as upsert:
        upsert.return_value = [{"moduleId": 8}]
        await ensure_bootstrap_company_setup_grant(session, employee_id=employee_id)
        await ensure_bootstrap_company_setup_grant(session, employee_id=employee_id)

    assert upsert.await_count == 2


@pytest.mark.asyncio
async def test_ensure_bootstrap_company_setup_grant_skips_when_catalog_missing() -> None:
    session = AsyncMock(spec=AsyncSession)
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    session.execute = AsyncMock(return_value=result)

    with patch(
        "app.modules.rbac.default_grants.upsert_employee_grants",
        new_callable=AsyncMock,
    ) as upsert:
        ok = await ensure_bootstrap_company_setup_grant(
            session, employee_id=uuid.uuid4()
        )

    assert ok is False
    upsert.assert_not_awaited()


@pytest.mark.asyncio
async def test_without_company_setup_grant_manage_access_denied_by_grant_check(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """DATA-10: without the seed grant, grant-level check denies Company Setup write.

    Legacy role fallback still exists until DATA-8; this asserts the grant
    path alone does not open Manage Access when grants are empty.
    """
    from app.core.roles import Role
    from app.modules.rbac.access import (
        MODULE_KEY_COMPANY_SETUP,
        require_module_access,
    )
    from fastapi import HTTPException

    user = {
        "employeeId": str(uuid.uuid4()),
        "role": "ADMIN",
        "department": "ADMIN",
    }
    # No legacy_roles → grant-only path (what DATA-8 will use).
    checker = require_module_access(
        MODULE_KEY_COMPANY_SETUP,
        min_level=ACCESS_LEVEL_FULL_ACCESS,
        legacy_roles=(),
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
    # Role alone is not enough when legacy_roles is empty.
    assert Role.ADMIN.value == user["role"]
