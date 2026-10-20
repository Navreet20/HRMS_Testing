"""Unit tests for leave balance helpers (schema gate deduct/restore)."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.modules.leave.balance_service import (
    compute_remaining,
    compute_rollover_days,
    prorate_personal_days,
)
from app.modules.leave.constants import DEFAULT_LEAVE_TYPES, UNPAID_LEAVE_TYPE_NAME


def test_default_leave_types_include_six_pdf_names() -> None:
    names = [n for n, _ in DEFAULT_LEAVE_TYPES]
    assert names == [
        "Personal Leave",
        "Sick Leave",
        "Maternity Leave",
        "Paternity Leave",
        "Medical Leave",
        "Unpaid Leave",
    ]
    assert UNPAID_LEAVE_TYPE_NAME in names


def test_compute_remaining_never_negative() -> None:
    assert compute_remaining(10, 0, 4) == Decimal("6")
    assert compute_remaining(10, 3, 12) == Decimal("1")
    assert compute_remaining(8, 0, 9) == Decimal("0")


def test_prorate_personal_july_10() -> None:
    # Jul 10 → months Jul–Dec = 6 → floor(10/12*6) = 5
    assert prorate_personal_days(10, date(2026, 7, 10), 2026) == Decimal("5")


def test_prorate_personal_july_20() -> None:
    # Jul 20 counts → 6 months → 5
    assert prorate_personal_days(10, date(2026, 7, 20), 2026) == Decimal("5")


def test_prorate_personal_july_25() -> None:
    # Jul 25 → start Aug → 5 months → floor(4.166…) = 4
    assert prorate_personal_days(10, date(2026, 7, 25), 2026) == Decimal("4")


def test_prorate_personal_full_year_existing() -> None:
    # Joined prior year → full entitlement
    assert prorate_personal_days(10, date(2025, 3, 1), 2026) == Decimal("10")


def test_prorate_personal_jan1_existing_employee() -> None:
    # Jan 1 grant for someone who joined last year → full Personal
    assert prorate_personal_days(12, date(2025, 6, 15), 2026) == Decimal("12")


def test_compute_rollover_caps_at_max() -> None:
    # Unused 8, max rollover 3 → CF 3
    assert (
        compute_rollover_days(8, rollover_allowed=True, max_rollover_days=3)
        == Decimal("3")
    )


def test_compute_rollover_uses_remaining_when_below_cap() -> None:
    assert (
        compute_rollover_days(2.5, rollover_allowed=True, max_rollover_days=3)
        == Decimal("2.5")
    )


def test_compute_rollover_off_is_zero() -> None:
    assert (
        compute_rollover_days(8, rollover_allowed=False, max_rollover_days=3)
        == Decimal("0")
    )


def test_compute_rollover_missing_max_is_zero() -> None:
    assert (
        compute_rollover_days(8, rollover_allowed=True, max_rollover_days=None)
        == Decimal("0")
    )


def test_compute_rollover_zero_remaining() -> None:
    assert (
        compute_rollover_days(0, rollover_allowed=True, max_rollover_days=3)
        == Decimal("0")
    )


def test_remaining_includes_carried_forward() -> None:
    # entitled 10 + CF 3 − used 2 = 11
    assert compute_remaining(10, 3, 2) == Decimal("11")


@pytest.mark.asyncio
async def test_ensure_year_balances_applies_rollover_and_full_sick(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Jan 1-style grant: full Personal + Sick; CF capped for Personal only."""
    from app.modules.leave import balance_service as svc

    employee_id = uuid.uuid4()
    policy_id = uuid.uuid4()
    personal_type_id = uuid.uuid4()
    sick_type_id = uuid.uuid4()
    year = 2027

    employee = MagicMock()
    employee.employee_id = employee_id
    employee.leave_policy_id = policy_id
    employee.employment_start_date = "2025-03-01"

    personal_type = MagicMock()
    personal_type.leave_type_name = "Personal Leave"
    sick_type = MagicMock()
    sick_type.leave_type_name = "Sick Leave"

    personal_line = MagicMock()
    personal_line.leave_type_id = personal_type_id
    personal_line.days_allowed = Decimal("10")
    personal_line.rollover_allowed = True
    personal_line.max_rollover_days = Decimal("3")

    sick_line = MagicMock()
    sick_line.leave_type_id = sick_type_id
    sick_line.days_allowed = Decimal("10")
    sick_line.rollover_allowed = False
    sick_line.max_rollover_days = None

    policy = MagicMock()
    policy.lines = [personal_line, sick_line]

    prior_personal = MagicMock()
    prior_personal.remaining_days = Decimal("8")

    created_rows: list[MagicMock] = []

    def capture_add(obj):  # noqa: ANN001
        created_rows.append(obj)

    db = AsyncMock()
    db.add = capture_add
    db.flush = AsyncMock()

    async def fake_get(_db_or_self, key, *args, **kwargs):  # noqa: ANN001
        # AsyncSession.get(entity, ident) — our code uses db.get(Model, id)
        if key is svc.Employee or (hasattr(key, "__name__") and key.__name__ == "Employee"):
            return employee
        if key == employee_id:
            return employee
        if key == personal_type_id:
            return personal_type
        if key == sick_type_id:
            return sick_type
        return None

    # SQLAlchemy async get is db.get(Entity, pk)
    async def db_get(entity, ident):  # noqa: ANN001
        if entity is svc.Employee:
            return employee
        if entity is svc.LeaveType:
            if ident == personal_type_id:
                return personal_type
            if ident == sick_type_id:
                return sick_type
        return None

    db.get = db_get

    policy_result = MagicMock()
    policy_result.scalar_one_or_none.return_value = policy

    none_result = MagicMock()
    none_result.scalar_one_or_none.return_value = None

    prior_result = MagicMock()
    prior_result.scalar_one_or_none.return_value = prior_personal

    call_count = {"n": 0}

    async def execute_side_effect(stmt):  # noqa: ANN001
        call_count["n"] += 1
        n = call_count["n"]
        # 1: load policy; then per line: existing year check, prior year
        if n == 1:
            return policy_result
        # Personal: existing (none), prior (8 remaining)
        # Sick: existing (none), prior (none → 0 CF anyway, rollover off)
        if n in (2, 4):
            return none_result  # no current-year row
        if n == 3:
            return prior_result  # Personal prior year
        if n == 5:
            return none_result  # Sick prior year missing
        return none_result

    db.execute = AsyncMock(side_effect=execute_side_effect)

    created = await svc.ensure_year_balances(
        db, employee_id, year, join_date=date(2025, 3, 1)
    )

    assert len(created) == 2
    personal_bal, sick_bal = created_rows[0], created_rows[1]

    assert personal_bal.leave_type_id == personal_type_id
    assert personal_bal.entitled_days == 10.0  # full — joined prior year
    assert personal_bal.carried_forward_days == 3.0  # min(8, 3)
    assert personal_bal.remaining_days == 13.0  # 10 + 3

    assert sick_bal.leave_type_id == sick_type_id
    assert sick_bal.entitled_days == 10.0  # Sick full 10, never prorated
    assert sick_bal.carried_forward_days == 0.0
    assert sick_bal.remaining_days == 10.0


@pytest.mark.asyncio
async def test_run_annual_leave_grant_scans_assigned_employees(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.modules.leave import balance_service as svc

    emp1 = MagicMock()
    emp1.employee_id = uuid.uuid4()
    emp2 = MagicMock()
    emp2.employee_id = uuid.uuid4()

    result = MagicMock()
    result.scalars.return_value.all.return_value = [emp1, emp2]

    db = AsyncMock()
    db.execute = AsyncMock(return_value=result)

    async def fake_ensure(_db, employee_id, leave_year, **kwargs):  # noqa: ANN001
        if employee_id == emp1.employee_id:
            return [MagicMock(), MagicMock()]
        return []

    monkeypatch.setattr(svc, "ensure_year_balances", fake_ensure)

    out = await svc.run_annual_leave_grant(db, leave_year=2027)
    assert out["leaveYear"] == 2027
    assert out["employeesScanned"] == 2
    assert out["employeesGranted"] == 1
    assert out["balancesCreated"] == 2
    assert out["errors"] == []


@pytest.mark.asyncio
async def test_apply_approval_deduction_happy_path(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.modules.leave import balance_service as svc

    employee_id = uuid.uuid4()
    leave_type_id = uuid.uuid4()
    request_id = uuid.uuid4()
    year = date.today().year

    day1 = MagicMock()
    day1.leave_year = year
    day1.day_value = Decimal("1.0")
    day2 = MagicMock()
    day2.leave_year = year
    day2.day_value = Decimal("0.5")

    request = MagicMock()
    request.leave_request_id = request_id
    request.employee_id = employee_id
    request.leave_type_id = leave_type_id
    request.days = [day1, day2]

    leave_type = MagicMock()
    leave_type.leave_type_name = "Personal Leave"

    balance = MagicMock()
    balance.entitled_days = Decimal("10")
    balance.carried_forward_days = Decimal("0")
    balance.used_days = Decimal("0")
    balance.remaining_days = Decimal("10")

    db = AsyncMock()
    db.get = AsyncMock(return_value=leave_type)

    load_result = MagicMock()
    load_result.scalar_one_or_none.return_value = request
    bal_result = MagicMock()
    bal_result.scalar_one_or_none.return_value = balance

    async def execute_side_effect(stmt):  # noqa: ANN001
        sql = str(stmt)
        if "LEAVE_BALANCE" in sql.upper() or "leave_balance" in sql.lower():
            return bal_result
        return load_result

    db.execute = AsyncMock(side_effect=execute_side_effect)
    db.flush = AsyncMock()

    async def fake_load(_db, _id):
        return request

    monkeypatch.setattr(svc, "_load_request_with_days", fake_load)

    out = await svc.apply_approval_deduction(db, request_id)
    assert out is request
    assert float(balance.used_days) == 1.5
    assert float(balance.remaining_days) == 8.5


@pytest.mark.asyncio
async def test_restore_on_reject_happy_path(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.modules.leave import balance_service as svc

    employee_id = uuid.uuid4()
    leave_type_id = uuid.uuid4()
    request_id = uuid.uuid4()
    year = date.today().year

    day1 = MagicMock()
    day1.leave_year = year
    day1.day_value = Decimal("1.0")

    request = MagicMock()
    request.leave_request_id = request_id
    request.employee_id = employee_id
    request.leave_type_id = leave_type_id
    request.days = [day1]

    leave_type = MagicMock()
    leave_type.leave_type_name = "Sick Leave"

    balance = MagicMock()
    balance.entitled_days = Decimal("10")
    balance.carried_forward_days = Decimal("0")
    balance.used_days = Decimal("1.0")
    balance.remaining_days = Decimal("9.0")

    db = AsyncMock()
    db.get = AsyncMock(return_value=leave_type)

    bal_result = MagicMock()
    bal_result.scalar_one_or_none.return_value = balance
    db.execute = AsyncMock(return_value=bal_result)
    db.flush = AsyncMock()

    async def fake_load(_db, _id):
        return request

    monkeypatch.setattr(svc, "_load_request_with_days", fake_load)

    out = await svc.restore_on_reject(db, request_id)
    assert out is request
    assert float(balance.used_days) == 0.0
    assert float(balance.remaining_days) == 10.0


def test_leave_type_to_dict_shape() -> None:
    from app.modules.leave.router import leave_type_to_dict

    row = MagicMock()
    row.leave_type_id = uuid.uuid4()
    row.leave_type_name = "Personal Leave"
    row.description = "Paid time off"
    row.status = "Active"
    payload = leave_type_to_dict(row)
    assert payload["leaveTypeName"] == "Personal Leave"
    assert payload["status"] == "Active"
    assert "leaveTypeId" in payload


async def test_short_leave_type_names_are_renamed_once() -> None:
    from app.modules.leave.seed import rename_legacy_leave_types

    result = MagicMock()
    result.scalar_one_or_none.return_value = None  # "Sick Leave" not taken yet
    result.rowcount = 1
    db = MagicMock()
    db.execute = AsyncMock(return_value=result)
    db.flush = AsyncMock()

    renamed = await rename_legacy_leave_types(db)

    assert renamed == 6
    # Per type: check the new name, rename the type, rename timesheet rows.
    assert db.execute.await_count == 18
    db.flush.assert_awaited_once()


async def test_short_name_duplicates_are_deleted_or_set_inactive() -> None:
    from app.modules.leave.seed import rename_legacy_leave_types

    result = MagicMock()
    result.scalar_one_or_none.return_value = "existing-id"  # "Sick Leave" already exists
    result.rowcount = 1
    db = MagicMock()
    db.execute = AsyncMock(return_value=result)
    db.flush = AsyncMock()

    await rename_legacy_leave_types(db)

    statements = [str(call.args[0]) for call in db.execute.await_args_list]
    deletes = [sql for sql in statements if sql.startswith('DELETE FROM "LEAVE_TYPE"')]
    deactivations = [
        sql for sql in statements if 'UPDATE "LEAVE_TYPE"' in sql and 'SET "STATUS"' in sql
    ]
    assert len(deletes) == 6
    # Unused duplicates are deleted; ones still in use are only set Inactive.
    assert all("NOT (EXISTS" in sql for sql in deletes)
    assert len(deactivations) == 6
