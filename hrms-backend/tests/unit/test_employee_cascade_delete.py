"""Hard-delete must block while reports / department-head links remain."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.modules.employee.service import EmployeeService


def _empty_execute_result() -> MagicMock:
    empty = MagicMock()
    empty.all.return_value = []
    empty.scalars.return_value.all.return_value = []
    return empty


@pytest.mark.asyncio
async def test_cascade_delete_blocks_system_account() -> None:
    svc = EmployeeService()
    emp = MagicMock()
    emp.is_system_account = True
    emp.employee_id = uuid.uuid4()
    session = AsyncMock()
    svc._get = AsyncMock(return_value=emp)  # type: ignore[method-assign]

    with pytest.raises(HTTPException) as exc:
        await svc.cascade_delete(session, emp.employee_id)
    assert exc.value.status_code == 403
    assert "System accounts" in str(exc.value.detail)
    session.delete.assert_not_called()


@pytest.mark.asyncio
@patch("app.modules.employee.service.record_field_change", new_callable=AsyncMock)
async def test_cascade_delete_blocks_when_direct_reports_exist(_audit: AsyncMock) -> None:
    svc = EmployeeService()
    eid = uuid.uuid4()
    emp = MagicMock()
    emp.is_system_account = False
    emp.employee_id = eid
    emp.status = "NEW"

    reports = MagicMock()
    reports.all.return_value = [("Ada", "Lovelace"), ("Grace", "Hopper")]
    session = AsyncMock()
    session.execute = AsyncMock(return_value=reports)
    session.delete = AsyncMock()
    svc._get = AsyncMock(return_value=emp)  # type: ignore[method-assign]

    with pytest.raises(HTTPException) as exc:
        await svc.cascade_delete(session, eid)

    assert exc.value.status_code == 409
    detail = str(exc.value.detail)
    assert "2 employee(s) still report" in detail
    assert "Ada Lovelace" in detail
    assert "Grace Hopper" in detail
    assert "Reassign those employees to another manager" in detail
    session.delete.assert_not_called()


@pytest.mark.asyncio
@patch("app.modules.employee.service.record_field_change", new_callable=AsyncMock)
async def test_cascade_delete_blocks_when_department_head(_audit: AsyncMock) -> None:
    svc = EmployeeService()
    eid = uuid.uuid4()
    emp = MagicMock()
    emp.is_system_account = False
    emp.employee_id = eid
    emp.status = "NEW"

    no_reports = MagicMock()
    no_reports.all.return_value = []
    dept_heads = MagicMock()
    dept_heads.all.return_value = [("Engineering",), ("Finance",)]

    session = AsyncMock()
    session.execute = AsyncMock(side_effect=[no_reports, dept_heads])
    session.delete = AsyncMock()
    svc._get = AsyncMock(return_value=emp)  # type: ignore[method-assign]

    with pytest.raises(HTTPException) as exc:
        await svc.cascade_delete(session, eid)

    assert exc.value.status_code == 409
    detail = str(exc.value.detail)
    assert "head of 2 department(s)" in detail
    assert "Engineering" in detail
    assert "Finance" in detail
    assert "Assign another department head first" in detail
    session.delete.assert_not_called()


@pytest.mark.asyncio
@patch("app.modules.employee.service.record_field_change", new_callable=AsyncMock)
async def test_cascade_delete_succeeds_without_inbound_hierarchy_refs(
    _audit: AsyncMock,
) -> None:
    svc = EmployeeService()
    eid = uuid.uuid4()
    emp = MagicMock()
    emp.is_system_account = False
    emp.employee_id = eid
    emp.status = "NEW"

    session = AsyncMock()
    session.execute = AsyncMock(return_value=_empty_execute_result())
    session.delete = AsyncMock()
    session.flush = AsyncMock()
    svc._get = AsyncMock(return_value=emp)  # type: ignore[method-assign]

    result = await svc.cascade_delete(session, eid)

    assert result == {"message": "Employee deleted"}
    session.delete.assert_awaited_once_with(emp)
    session.flush.assert_awaited()
    # Must not auto-null REPORTING_MANAGER_ID / DEPARTMENT_HEAD_ID.
    executed_sql = [str(args[0][0]) for args in session.execute.await_args_list]
    assert not any(
        "UPDATE" in sql.upper() and "REPORTING_MANAGER_ID" in sql.upper()
        for sql in executed_sql
    )
    assert not any(
        "UPDATE" in sql.upper() and "DEPARTMENT_HEAD_ID" in sql.upper()
        for sql in executed_sql
    )
    assert any(
        "EMPLOYEE_FIELD_AUDIT" in sql.upper()
        and "UPDATE" in sql.upper()
        and "EMPLOYEE_ID" in sql.upper()
        for sql in executed_sql
    )


@pytest.mark.asyncio
async def test_cascade_delete_rejects_non_draft_employees() -> None:
    svc = EmployeeService()
    emp = MagicMock()
    emp.is_system_account = False
    emp.employee_id = uuid.uuid4()
    emp.status = "ACTIVE"
    session = AsyncMock()
    svc._get = AsyncMock(return_value=emp)  # type: ignore[method-assign]

    with pytest.raises(HTTPException) as exc:
        await svc.cascade_delete(session, emp.employee_id)
    assert exc.value.status_code == 400
    assert "NEW drafts" in str(exc.value.detail)
    session.delete.assert_not_called()
