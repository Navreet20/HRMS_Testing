"""'Also off on these days': teammates on leave on the same dates."""

from __future__ import annotations

import uuid
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.modules.leave_approvals import service as svc

ACTOR = {"employeeId": str(uuid.uuid4())}


def _request() -> SimpleNamespace:
    return SimpleNamespace(
        leave_request_id=uuid.uuid4(),
        employee_id=uuid.uuid4(),
        from_date=date(2026, 10, 12),
        to_date=date(2026, 10, 16),
    )


@pytest.mark.asyncio
async def test_lists_teammates_with_overlapping_leave() -> None:
    request = _request()
    employee = SimpleNamespace(reporting_manager_id=uuid.uuid4())
    other = SimpleNamespace(
        employee_id=uuid.uuid4(),
        first_name="Durga",
        last_name="Paruchuri",
        business_employee_id="EMP00001",
    )
    other_request = SimpleNamespace(
        from_date=date(2026, 10, 14), to_date=date(2026, 10, 15), status="Approved"
    )
    result = MagicMock()
    result.all.return_value = [(other_request, other, SimpleNamespace(leave_type_name="Sick Leave"))]
    db = MagicMock()
    db.execute = AsyncMock(return_value=result)

    with patch.object(svc, "_load_for_review", AsyncMock(return_value=(request, employee, None))):
        rows = await svc.team_off(db, ACTOR, request.leave_request_id)

    assert len(rows) == 1
    assert rows[0]["employeeName"] == "Durga Paruchuri"
    assert rows[0]["leaveTypeName"] == "Sick Leave"
    assert rows[0]["fromDate"] == "2026-10-14"
    assert rows[0]["status"] == "Approved"


@pytest.mark.asyncio
async def test_no_manager_means_no_team_to_compare_with() -> None:
    request = _request()
    employee = SimpleNamespace(reporting_manager_id=None)
    db = MagicMock()
    db.execute = AsyncMock()
    with patch.object(svc, "_load_for_review", AsyncMock(return_value=(request, employee, None))):
        assert await svc.team_off(db, ACTOR, request.leave_request_id) == []
    db.execute.assert_not_called()


def _statement_text(db) -> str:
    return str(db.execute.await_args.args[0].compile(compile_kwargs={"literal_binds": True}))


@pytest.mark.asyncio
async def test_a_manager_sees_only_the_requesters_team_but_hr_sees_everyone() -> None:
    request = _request()
    employee = SimpleNamespace(reporting_manager_id=uuid.uuid4())

    async def run(actor_is_admin: bool) -> str:
        result = MagicMock()
        result.all.return_value = []
        db = MagicMock()
        db.execute = AsyncMock(return_value=result)
        with patch.object(
            svc, "_load_for_review", AsyncMock(return_value=(request, employee, None))
        ), patch.object(svc, "is_leave_admin", lambda actor: actor_is_admin):
            await svc.team_off(db, ACTOR, request.leave_request_id)
        return _statement_text(db)

    manager_sql = await run(False)
    hr_sql = await run(True)
    # Only the WHERE clause matters (the SELECT lists every employee column).
    assert "REPORTING_MANAGER_ID" in manager_sql.split("\nWHERE ", 1)[1]
    assert "REPORTING_MANAGER_ID" not in hr_sql.split("\nWHERE ", 1)[1]
    assert "LIMIT 100" in hr_sql


@pytest.mark.asyncio
async def test_hr_still_sees_who_is_off_when_the_requester_has_no_manager() -> None:
    request = _request()
    employee = SimpleNamespace(reporting_manager_id=None)
    result = MagicMock()
    result.all.return_value = []
    db = MagicMock()
    db.execute = AsyncMock(return_value=result)
    with patch.object(
        svc, "_load_for_review", AsyncMock(return_value=(request, employee, None))
    ), patch.object(svc, "is_leave_admin", lambda actor: True):
        assert await svc.team_off(db, ACTOR, request.leave_request_id) == []
    db.execute.assert_awaited_once()
