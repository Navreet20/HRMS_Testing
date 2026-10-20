"""GET /me/project-allocation gates My projects nav."""

from __future__ import annotations

import uuid
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.modules.employee.service import EmployeeService


@pytest.mark.asyncio
async def test_project_allocation_option_true_when_open_allocation() -> None:
    employee_id = uuid.uuid4()
    alloc_result = MagicMock()
    alloc_result.scalar_one_or_none.return_value = uuid.uuid4()
    session = AsyncMock()
    session.execute = AsyncMock(return_value=alloc_result)

    out = await EmployeeService().project_allocation_option(
        session, {"employeeId": str(employee_id)}
    )
    assert out == {"hasActiveAllocation": True}
    session.execute.assert_awaited_once()


@pytest.mark.asyncio
async def test_project_allocation_option_false_when_none() -> None:
    employee_id = uuid.uuid4()
    empty = MagicMock()
    empty.scalar_one_or_none.return_value = None
    session = AsyncMock()
    session.execute = AsyncMock(side_effect=[empty, empty])

    out = await EmployeeService().project_allocation_option(
        session, {"employeeId": str(employee_id)}
    )
    assert out == {"hasActiveAllocation": False}
    assert session.execute.await_count == 2
