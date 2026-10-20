"""Unit tests for LEAVE-DATA-5 policy assign / change helpers."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.modules.leave.constants import MASTER_STATUS_ACTIVE
from app.modules.leave.policy_assignment import (
    LEAVE_POLICY_REQUIRED,
    apply_policy_change_balances,
    require_leave_policy_on_body,
)


def test_require_leave_policy_on_body_rejects_missing() -> None:
    with pytest.raises(HTTPException) as exc:
        require_leave_policy_on_body({})
    assert exc.value.status_code == 400
    assert exc.value.detail == LEAVE_POLICY_REQUIRED


def test_require_leave_policy_falls_back_to_existing() -> None:
    existing = MagicMock()
    existing.leave_policy_id = uuid.uuid4()
    assert require_leave_policy_on_body({}, existing=existing) == str(
        existing.leave_policy_id
    )


@pytest.mark.asyncio
async def test_apply_policy_change_remaining_floors_at_zero(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.modules.leave import policy_assignment as svc

    employee_id = uuid.uuid4()
    leave_type_id = uuid.uuid4()
    year = date.today().year

    leave_type = MagicMock()
    leave_type.leave_type_name = "Sick Leave"

    line = MagicMock()
    line.leave_type_id = leave_type_id
    line.days_allowed = 5

    policy = MagicMock()
    policy.lines = [line]

    balance = MagicMock()
    balance.used_days = 8
    balance.entitled_days = 10
    balance.remaining_days = 2

    db = AsyncMock()

    async def fake_get(_db, key):
        if key == leave_type_id:
            return leave_type
        return None

    existing_result = MagicMock()
    existing_result.scalar_one_or_none.return_value = balance
    db.execute = AsyncMock(return_value=existing_result)
    db.get = fake_get
    db.flush = AsyncMock()

    monkeypatch.setattr(svc, "LeaveType", MagicMock)
    updated = await apply_policy_change_balances(db, employee_id, policy, leave_year=year)

    assert updated == [balance]
    assert balance.entitled_days == 5.0
    assert balance.used_days == 8  # unchanged
    assert balance.remaining_days == 0.0


@pytest.mark.asyncio
async def test_apply_policy_change_remaining_equals_days_minus_used(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.modules.leave import policy_assignment as svc

    employee_id = uuid.uuid4()
    leave_type_id = uuid.uuid4()
    year = date.today().year

    leave_type = MagicMock()
    leave_type.leave_type_name = "Personal Leave"

    line = MagicMock()
    line.leave_type_id = leave_type_id
    line.days_allowed = 12

    policy = MagicMock()
    policy.lines = [line]

    balance = MagicMock()
    balance.used_days = 3
    balance.entitled_days = 10
    balance.remaining_days = 7

    db = AsyncMock()
    existing_result = MagicMock()
    existing_result.scalar_one_or_none.return_value = balance
    db.execute = AsyncMock(return_value=existing_result)
    db.flush = AsyncMock()

    async def fake_get(_db, key):
        return leave_type if key == leave_type_id else None

    db.get = fake_get
    monkeypatch.setattr(svc, "LeaveType", MagicMock)

    await apply_policy_change_balances(db, employee_id, policy, leave_year=year)
    assert balance.entitled_days == 12.0
    assert balance.used_days == 3
    assert balance.remaining_days == 9.0
    assert Decimal(str(balance.remaining_days)) == Decimal("9.0")


def test_active_constant_for_assignment() -> None:
    assert MASTER_STATUS_ACTIVE == "Active"
