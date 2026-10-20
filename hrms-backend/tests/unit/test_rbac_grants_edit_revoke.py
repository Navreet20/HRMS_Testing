"""RBAC-DATA-6: edit access_level + soft revoke grants."""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.rbac.grants import (
    ACCESS_LEVEL_FULL_ACCESS,
    ACCESS_LEVEL_READ_ONLY,
    GRANT_STATUS_ACTIVE,
    GRANT_STATUS_REVOKED,
    revoke_grant,
    update_grant_access_level,
)
from app.modules.rbac.service import MASTER_STATUS_ACTIVE


@pytest.mark.asyncio
async def test_update_grant_access_level_updates_active_row() -> None:
    employee_id = uuid.uuid4()
    grant_id = uuid.uuid4()
    module = SimpleNamespace(
        module_name="Clients",
        has_submodules=False,
    )
    row = SimpleNamespace(
        grant_id=grant_id,
        employee_id=employee_id,
        module_id=3,
        submodule_id=None,
        access_level=ACCESS_LEVEL_READ_ONLY,
        granted_by=None,
        granted_date=None,
        status=GRANT_STATUS_ACTIVE,
        module=module,
        submodule=None,
    )

    emp_result = MagicMock()
    emp_result.scalar_one_or_none.return_value = SimpleNamespace(
        employee_id=employee_id
    )
    grant_result = MagicMock()
    grant_result.scalar_one_or_none.return_value = row

    session = AsyncMock(spec=AsyncSession)
    session.flush = AsyncMock()
    session.execute = AsyncMock(side_effect=[emp_result, grant_result])

    payload = await update_grant_access_level(
        session,
        employee_id=employee_id,
        grant_id=grant_id,
        access_level=ACCESS_LEVEL_FULL_ACCESS,
        granted_by=None,
    )
    assert row.access_level == ACCESS_LEVEL_FULL_ACCESS
    assert row.status == GRANT_STATUS_ACTIVE
    assert payload["accessLevel"] == ACCESS_LEVEL_FULL_ACCESS


@pytest.mark.asyncio
async def test_update_grant_rejects_revoked_row() -> None:
    employee_id = uuid.uuid4()
    grant_id = uuid.uuid4()
    row = SimpleNamespace(
        grant_id=grant_id,
        employee_id=employee_id,
        module_id=3,
        submodule_id=None,
        access_level=ACCESS_LEVEL_READ_ONLY,
        granted_by=None,
        granted_date=None,
        status=GRANT_STATUS_REVOKED,
        module=SimpleNamespace(module_name="Clients", has_submodules=False),
        submodule=None,
    )
    emp_result = MagicMock()
    emp_result.scalar_one_or_none.return_value = SimpleNamespace(
        employee_id=employee_id
    )
    grant_result = MagicMock()
    grant_result.scalar_one_or_none.return_value = row
    session = AsyncMock(spec=AsyncSession)
    session.execute = AsyncMock(side_effect=[emp_result, grant_result])

    with pytest.raises(HTTPException) as exc:
        await update_grant_access_level(
            session,
            employee_id=employee_id,
            grant_id=grant_id,
            access_level=ACCESS_LEVEL_FULL_ACCESS,
            granted_by=None,
        )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_revoke_grant_sets_revoked_status() -> None:
    employee_id = uuid.uuid4()
    grant_id = uuid.uuid4()
    row = SimpleNamespace(
        grant_id=grant_id,
        employee_id=employee_id,
        module_id=3,
        submodule_id=None,
        access_level=ACCESS_LEVEL_FULL_ACCESS,
        granted_by=None,
        granted_date=None,
        status=GRANT_STATUS_ACTIVE,
        module=SimpleNamespace(
            module_name="Clients",
            has_submodules=False,
            status=MASTER_STATUS_ACTIVE,
        ),
        submodule=None,
    )
    emp_result = MagicMock()
    emp_result.scalar_one_or_none.return_value = SimpleNamespace(
        employee_id=employee_id
    )
    grant_result = MagicMock()
    grant_result.scalar_one_or_none.return_value = row
    session = AsyncMock(spec=AsyncSession)
    session.flush = AsyncMock()
    session.execute = AsyncMock(side_effect=[emp_result, grant_result])

    payload = await revoke_grant(
        session,
        employee_id=employee_id,
        grant_id=grant_id,
        granted_by=None,
    )
    assert row.status == GRANT_STATUS_REVOKED
    assert payload["status"] == GRANT_STATUS_REVOKED
