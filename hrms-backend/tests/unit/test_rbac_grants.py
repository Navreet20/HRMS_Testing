"""RBAC-DATA-2: employee access grant upsert / search service."""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tables import EmployeeAccessGrant
from app.modules.rbac.grants import (
    ACCESS_LEVEL_FULL_ACCESS,
    ACCESS_LEVEL_READ_ONLY,
    GRANT_STATUS_ACTIVE,
    GRANT_STATUS_REVOKED,
    list_directory_employees,
    list_employee_grants,
    search_employees_by_email,
    upsert_employee_grants,
)
from app.modules.rbac.router import router as rbac_router
from app.modules.rbac.service import MASTER_STATUS_ACTIVE


def test_rbac_grant_routes_registered() -> None:
    paths = {getattr(route, "path", "") for route in rbac_router.routes}
    assert "/rbac/employees" in paths
    assert "/rbac/employees/search" in paths
    assert "/rbac/employees/{employee_id}/grants" in paths
    assert "/rbac/employees/{employee_id}/grants/{grant_id}" in paths
    assert "/rbac/employees/{employee_id}/grants/{grant_id}/revoke" in paths
    grant_methods = {
        method
        for route in rbac_router.routes
        if getattr(route, "path", "") == "/rbac/employees/{employee_id}/grants"
        for method in (getattr(route, "methods", None) or set())
    }
    assert grant_methods == {"GET", "PUT"}


@pytest.mark.asyncio
async def test_search_employees_requires_two_chars() -> None:
    session = AsyncMock(spec=AsyncSession)
    with pytest.raises(HTTPException) as exc:
        await search_employees_by_email(session, email="a")
    assert exc.value.status_code == 400


def _sql(stmt) -> str:
    return str(stmt.compile(compile_kwargs={"literal_binds": True})).lower()


@pytest.mark.asyncio
async def test_directory_lists_only_active_employees() -> None:
    count_result = MagicMock()
    count_result.scalar_one.return_value = 0
    rows_result = MagicMock()
    rows_result.scalars.return_value.all.return_value = []
    session = AsyncMock(spec=AsyncSession)
    session.execute = AsyncMock(side_effect=[count_result, rows_result])

    out = await list_directory_employees(session, q="sam")

    assert out["items"] == []
    for call in session.execute.await_args_list:
        sql = _sql(call.args[0])
        assert """upper(coalesce("employee"."status", '')) = 'active'""" in sql


@pytest.mark.asyncio
async def test_email_search_lists_only_active_employees() -> None:
    result = MagicMock()
    result.scalars.return_value.all.return_value = []
    session = AsyncMock(spec=AsyncSession)
    session.execute = AsyncMock(return_value=result)

    assert await search_employees_by_email(session, email="sam") == []
    sql = _sql(session.execute.await_args.args[0])
    assert """upper(coalesce("employee"."status", '')) = 'active'""" in sql


@pytest.mark.asyncio
async def test_upsert_rejects_missing_module() -> None:
    employee_id = uuid.uuid4()
    emp_result = MagicMock()
    emp_result.scalar_one_or_none.return_value = SimpleNamespace(
        employee_id=employee_id
    )
    session = AsyncMock(spec=AsyncSession)
    session.execute = AsyncMock(return_value=emp_result)

    with pytest.raises(HTTPException) as exc:
        await upsert_employee_grants(
            session,
            employee_id=employee_id,
            payload={"accessLevel": ACCESS_LEVEL_FULL_ACCESS},
            granted_by=None,
        )
    assert exc.value.status_code == 400
    assert "moduleId" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_upsert_rejects_submodule_module_without_selection() -> None:
    employee_id = uuid.uuid4()
    module = SimpleNamespace(
        module_id=2,
        module_name="Employees",
        has_submodules=True,
        status=MASTER_STATUS_ACTIVE,
        submodules=[
            SimpleNamespace(
                submodule_id=1,
                status=MASTER_STATUS_ACTIVE,
                submodule_name="Onboarding",
            )
        ],
    )

    emp_result = MagicMock()
    emp_result.scalar_one_or_none.return_value = SimpleNamespace(
        employee_id=employee_id
    )
    mod_result = MagicMock()
    mod_result.scalar_one_or_none.return_value = module

    session = AsyncMock(spec=AsyncSession)
    session.execute = AsyncMock(side_effect=[emp_result, mod_result])

    with pytest.raises(HTTPException) as exc:
        await upsert_employee_grants(
            session,
            employee_id=employee_id,
            payload={
                "moduleId": 2,
                "accessLevel": ACCESS_LEVEL_READ_ONLY,
                "submoduleIds": [],
            },
            granted_by=None,
        )
    assert exc.value.status_code == 400
    assert "submodule" in str(exc.value.detail).lower()


@pytest.mark.asyncio
async def test_upsert_flat_module_inserts_null_submodule() -> None:
    employee_id = uuid.uuid4()
    module = SimpleNamespace(
        module_id=3,
        module_name="Clients",
        has_submodules=False,
        status=MASTER_STATUS_ACTIVE,
        submodules=[],
    )

    emp_result = MagicMock()
    emp_result.scalar_one_or_none.return_value = SimpleNamespace(
        employee_id=employee_id
    )
    mod_result = MagicMock()
    mod_result.scalar_one_or_none.return_value = module
    existing_result = MagicMock()
    existing_result.scalars.return_value.first.return_value = None

    created: list[EmployeeAccessGrant] = []

    def add(obj: object) -> None:
        if isinstance(obj, EmployeeAccessGrant):
            created.append(obj)

    reload_row = SimpleNamespace(
        grant_id=uuid.uuid4(),
        employee_id=employee_id,
        module_id=3,
        submodule_id=None,
        access_level=ACCESS_LEVEL_FULL_ACCESS,
        granted_by=None,
        granted_date=None,
        status=GRANT_STATUS_ACTIVE,
        module=module,
        submodule=None,
    )
    reload_result = MagicMock()
    unique = MagicMock()
    unique.all.return_value = [reload_row]
    scalars = MagicMock()
    scalars.unique.return_value = unique
    reload_result.scalars.return_value = scalars

    session = AsyncMock(spec=AsyncSession)
    session.add = add
    session.flush = AsyncMock()
    session.execute = AsyncMock(
        side_effect=[emp_result, mod_result, existing_result, reload_result]
    )

    payload = await upsert_employee_grants(
        session,
        employee_id=employee_id,
        payload={"moduleId": 3, "accessLevel": ACCESS_LEVEL_FULL_ACCESS},
        granted_by=None,
    )
    assert len(created) == 1
    assert created[0].submodule_id is None
    assert created[0].status == GRANT_STATUS_ACTIVE
    assert created[0].access_level == ACCESS_LEVEL_FULL_ACCESS
    assert payload[0]["moduleId"] == 3
    assert payload[0]["submoduleId"] is None


@pytest.mark.asyncio
async def test_upsert_updates_existing_active_instead_of_duplicate() -> None:
    employee_id = uuid.uuid4()
    module = SimpleNamespace(
        module_id=3,
        module_name="Clients",
        has_submodules=False,
        status=MASTER_STATUS_ACTIVE,
        submodules=[],
    )
    existing = SimpleNamespace(
        grant_id=uuid.uuid4(),
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
    mod_result = MagicMock()
    mod_result.scalar_one_or_none.return_value = module
    existing_result = MagicMock()
    existing_result.scalars.return_value.first.return_value = existing

    reload_result = MagicMock()
    unique = MagicMock()
    unique.all.return_value = [existing]
    scalars = MagicMock()
    scalars.unique.return_value = unique
    reload_result.scalars.return_value = scalars

    session = AsyncMock(spec=AsyncSession)
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.execute = AsyncMock(
        side_effect=[emp_result, mod_result, existing_result, reload_result]
    )

    payload = await upsert_employee_grants(
        session,
        employee_id=employee_id,
        payload={"moduleId": 3, "accessLevel": ACCESS_LEVEL_FULL_ACCESS},
        granted_by=None,
    )
    # Existing grant is updated in place; only ACCESS_GRANT_AUDIT is inserted.
    assert all(
        not isinstance(call.args[0], EmployeeAccessGrant)
        for call in session.add.call_args_list
    )
    assert existing.access_level == ACCESS_LEVEL_FULL_ACCESS
    assert existing.status == GRANT_STATUS_ACTIVE
    assert payload[0]["accessLevel"] == ACCESS_LEVEL_FULL_ACCESS


@pytest.mark.asyncio
async def test_upsert_reactivates_revoked_row() -> None:
    employee_id = uuid.uuid4()
    module = SimpleNamespace(
        module_id=3,
        module_name="Clients",
        has_submodules=False,
        status=MASTER_STATUS_ACTIVE,
        submodules=[],
    )
    existing = SimpleNamespace(
        grant_id=uuid.uuid4(),
        employee_id=employee_id,
        module_id=3,
        submodule_id=None,
        access_level=ACCESS_LEVEL_READ_ONLY,
        granted_by=None,
        granted_date=None,
        status=GRANT_STATUS_REVOKED,
        module=module,
        submodule=None,
    )

    emp_result = MagicMock()
    emp_result.scalar_one_or_none.return_value = SimpleNamespace(
        employee_id=employee_id
    )
    mod_result = MagicMock()
    mod_result.scalar_one_or_none.return_value = module
    existing_result = MagicMock()
    existing_result.scalars.return_value.first.return_value = existing

    reload_result = MagicMock()
    unique = MagicMock()
    unique.all.return_value = [existing]
    scalars = MagicMock()
    scalars.unique.return_value = unique
    reload_result.scalars.return_value = scalars

    session = AsyncMock(spec=AsyncSession)
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.execute = AsyncMock(
        side_effect=[emp_result, mod_result, existing_result, reload_result]
    )

    await upsert_employee_grants(
        session,
        employee_id=employee_id,
        payload={"moduleId": 3, "accessLevel": ACCESS_LEVEL_FULL_ACCESS},
        granted_by=None,
    )
    assert existing.status == GRANT_STATUS_ACTIVE
    assert existing.access_level == ACCESS_LEVEL_FULL_ACCESS
    assert all(
        not isinstance(call.args[0], EmployeeAccessGrant)
        for call in session.add.call_args_list
    )


@pytest.mark.asyncio
async def test_list_employee_grants_404_when_missing() -> None:
    session = AsyncMock(spec=AsyncSession)
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    session.execute = AsyncMock(return_value=result)
    with pytest.raises(HTTPException) as exc:
        await list_employee_grants(session, employee_id=uuid.uuid4())
    assert exc.value.status_code == 404
