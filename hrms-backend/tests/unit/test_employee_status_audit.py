"""soft_delete and activate_due must write an audit entry for every status change."""

from __future__ import annotations

import uuid
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.roles import Status
from app.modules.employee.service import EmployeeService

_AUDIT = "app.modules.employee.service.record_field_change"


def _employee(status: str) -> MagicMock:
    emp = MagicMock()
    emp.employee_id = uuid.uuid4()
    emp.is_system_account = False
    emp.status = status
    return emp


@pytest.mark.asyncio
async def test_soft_delete_records_who_and_previous_status() -> None:
    svc = EmployeeService()
    emp = _employee(Status.ACTIVE.value)
    svc._get = AsyncMock(return_value=emp)  # type: ignore[method-assign]
    actor = {"firstName": "Hana", "lastName": "Lee", "employeeId": str(uuid.uuid4())}

    with (
        patch(_AUDIT, new_callable=AsyncMock) as audit,
        patch("app.modules.employee.service.employee_to_dict", return_value={}),
    ):
        await svc.soft_delete(AsyncMock(), emp.employee_id, actor=actor)

    assert emp.status == Status.INACTIVE
    audit.assert_awaited_once()
    kwargs = audit.await_args.kwargs
    assert kwargs["employee_id"] == emp.employee_id
    assert kwargs["field_name"] == "status"
    assert kwargs["old_value"] == Status.ACTIVE.value
    assert kwargs["new_value"] == Status.INACTIVE.value
    assert kwargs["actor"] is actor


@pytest.mark.asyncio
async def test_activate_due_audits_each_employee_with_the_caller() -> None:
    svc = EmployeeService()
    first, second = _employee(Status.PENDING.value), _employee(Status.PENDING.value)
    for emp in (first, second):
        emp.employment_start_date = "2020-01-01"
        emp.payroll_start_date = None
    result = MagicMock()
    result.scalars.return_value.all.return_value = [first, second]
    session = AsyncMock()
    session.execute = AsyncMock(return_value=result)
    actor = {"firstName": "Hana", "lastName": "Lee"}

    with (
        patch("app.modules.employee.service.utc_today", return_value=date(2026, 8, 24)),
        patch.object(svc, "_ensure_business_employee_id", AsyncMock()),
        patch(_AUDIT, new_callable=AsyncMock) as audit,
    ):
        out = await svc.activate_due(session, actor=actor)

    assert out["activatedCount"] == 2
    assert audit.await_count == 2
    audited = {call.kwargs["employee_id"] for call in audit.await_args_list}
    assert audited == {first.employee_id, second.employee_id}
    for call in audit.await_args_list:
        assert call.kwargs["field_name"] == "lifecycle"
        assert call.kwargs["old_value"] == Status.PENDING.value
        assert call.kwargs["new_value"] == "Activated"
        assert call.kwargs["actor"] is actor


@pytest.mark.asyncio
async def test_activate_due_audits_as_system_without_an_actor() -> None:
    svc = EmployeeService()
    emp = _employee(Status.PENDING.value)
    emp.employment_start_date = "2020-01-01"
    emp.payroll_start_date = None
    result = MagicMock()
    result.scalars.return_value.all.return_value = [emp]
    session = AsyncMock()
    session.execute = AsyncMock(return_value=result)

    with (
        patch("app.modules.employee.service.utc_today", return_value=date(2026, 8, 24)),
        patch.object(svc, "_ensure_business_employee_id", AsyncMock()),
        patch(_AUDIT, new_callable=AsyncMock) as audit,
    ):
        await svc.activate_due(session)

    actor = audit.await_args.kwargs["actor"]
    assert actor["firstName"] == "System"
    assert actor["system"] is True


@pytest.mark.asyncio
async def test_activate_due_skips_audit_when_not_yet_due() -> None:
    svc = EmployeeService()
    emp = _employee(Status.PENDING.value)
    emp.employment_start_date = "2099-01-01"
    result = MagicMock()
    result.scalars.return_value.all.return_value = [emp]
    session = AsyncMock()
    session.execute = AsyncMock(return_value=result)

    with (
        patch("app.modules.employee.service.utc_today", return_value=date(2026, 8, 24)),
        patch(_AUDIT, new_callable=AsyncMock) as audit,
    ):
        out = await svc.activate_due(session)

    assert out["activatedCount"] == 0
    audit.assert_not_awaited()


def test_audit_row_for_system_actor_has_system_role() -> None:
    from app.modules.employee.employment_updates import (
        SYSTEM_AUDIT_ACTOR,
        build_audit_rows,
    )

    rows = build_audit_rows(
        employee_id=uuid.uuid4(),
        before={"lifecycle": "PENDING"},
        after={"lifecycle": "Activated"},
        actor=SYSTEM_AUDIT_ACTOR,
    )

    assert len(rows) == 1
    assert rows[0]["changed_by"] == "System"
    assert rows[0]["changed_by_role"] == "System"
    assert rows[0]["changed_by_id"] is None


def test_audit_row_for_signed_in_user_keeps_their_role() -> None:
    from app.modules.employee.employment_updates import build_audit_rows

    rows = build_audit_rows(
        employee_id=uuid.uuid4(),
        before={"status": "ACTIVE"},
        after={"status": "INACTIVE"},
        actor={"firstName": "Hana", "lastName": "Lee", "role": "HR"},
    )

    assert rows[0]["changed_by"] == "Hana Lee"
    assert rows[0]["changed_by_role"] != "System"
