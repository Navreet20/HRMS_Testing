"""ESS-DATA-1/5 managing-option / has_direct_reports / functional flags."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.modules.employee.service import EmployeeService


@pytest.mark.asyncio
async def test_has_direct_reports_true_when_row_exists() -> None:
    session = AsyncMock()
    manager_id = str(uuid4())
    report_id = uuid4()
    result = MagicMock()
    result.scalar_one_or_none.return_value = report_id
    session.execute = AsyncMock(return_value=result)

    assert await EmployeeService().has_direct_reports(session, manager_id) is True
    session.execute.assert_awaited_once()


@pytest.mark.asyncio
async def test_has_direct_reports_false_when_none() -> None:
    session = AsyncMock()
    manager_id = str(uuid4())
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    session.execute = AsyncMock(return_value=result)

    assert await EmployeeService().has_direct_reports(session, manager_id) is False


@pytest.mark.asyncio
async def test_managing_option_returns_flags_for_employee() -> None:
    session = AsyncMock()
    employee_id = str(uuid4())
    svc = EmployeeService()
    svc.has_direct_reports = AsyncMock(return_value=True)  # type: ignore[method-assign]

    payload = await svc.managing_option(
        session, {"employeeId": employee_id, "role": "EMPLOYEE"}
    )

    assert payload == {
        "hasDirectReports": True,
        "canManageProfileUpdates": False,
        "canManageAssetRequests": False,
        "canManageItRequests": False,
        "canManageTimesheets": False,
        "canManageLeaves": False,
    }
    svc.has_direct_reports.assert_awaited_once_with(session, employee_id)


@pytest.mark.asyncio
async def test_managing_option_sets_functional_flags_for_hr() -> None:
    session = AsyncMock()
    employee_id = str(uuid4())
    svc = EmployeeService()
    svc.has_direct_reports = AsyncMock(return_value=False)  # type: ignore[method-assign]

    payload = await svc.managing_option(
        session, {"employeeId": employee_id, "role": "HR"}
    )

    assert payload == {
        "hasDirectReports": False,
        "canManageProfileUpdates": True,
        "canManageAssetRequests": True,
        "canManageItRequests": True,
        "canManageTimesheets": True,
        "canManageLeaves": True,
    }


@pytest.mark.asyncio
async def test_managing_option_rejects_missing_employee_id() -> None:
    session = AsyncMock()
    with pytest.raises(HTTPException) as exc:
        await EmployeeService().managing_option(session, {})
    assert exc.value.status_code == 401
