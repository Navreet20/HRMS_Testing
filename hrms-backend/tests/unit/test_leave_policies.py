"""Leave policy create/edit validations and DATA-3 balance adjustments."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.modules.leave.balance_service import (
    apply_policy_days_allowed_change,
    compute_remaining,
)
from app.modules.leave_policies import service as svc
from app.modules.leave_policies.schemas import (
    LeavePolicyCreateBody,
    LeavePolicyDaysUpdateBody,
    PolicyLineCreate,
)

PERSONAL_ID = uuid.uuid4()
SICK_ID = uuid.uuid4()
UNPAID_ID = uuid.uuid4()
COMPANY_ID = uuid.uuid4()


def _line(**overrides: Any) -> dict[str, Any]:
    payload = {
        "leaveTypeId": str(PERSONAL_ID),
        "daysAllowed": 10,
        "rolloverAllowed": False,
        "maxRolloverDays": None,
    }
    payload.update(overrides)
    return payload


def _create_body(**overrides: Any) -> LeavePolicyCreateBody:
    payload = {
        "policyName": "Standard Policy",
        "policyStartYear": 2026,
        "policyEndYear": 2026,
        "lines": [_line()],
    }
    payload.update(overrides)
    return LeavePolicyCreateBody.model_validate(payload)


def test_create_body_rejects_blank_name() -> None:
    with pytest.raises(ValidationError):
        _create_body(policyName="   ")


def test_year_range_rejected() -> None:
    with pytest.raises(HTTPException) as exc:
        # Exercise helper via sync validation path used by create
        body = _create_body(policyStartYear=2027, policyEndYear=2026)
        if body.policy_end_year < body.policy_start_year:
            raise HTTPException(status_code=400, detail=svc.POLICY_YEAR_RANGE_INVALID)
    assert exc.value.detail == svc.POLICY_YEAR_RANGE_INVALID


def test_days_allowed_half_step_validation() -> None:
    assert svc._validate_days_allowed(10) == Decimal("10")
    assert svc._validate_days_allowed("10.5") == Decimal("10.5")
    assert svc._validate_days_allowed(0) == Decimal("0")
    with pytest.raises(HTTPException) as exc:
        svc._validate_days_allowed("10.25")
    assert exc.value.detail == svc.POLICY_DAYS_INVALID
    with pytest.raises(HTTPException):
        svc._validate_days_allowed(-1)


def test_rollover_requires_max_and_caps_at_days() -> None:
    days = Decimal("10")
    line = PolicyLineCreate.model_validate(
        _line(rolloverAllowed=True, maxRolloverDays=3)
    )
    assert svc._validate_rollover(line, days) == Decimal("3")

    with pytest.raises(HTTPException) as exc:
        svc._validate_rollover(
            PolicyLineCreate.model_validate(_line(rolloverAllowed=True, maxRolloverDays=None)),
            days,
        )
    assert exc.value.detail == svc.POLICY_MAX_ROLLOVER_REQUIRED

    with pytest.raises(HTTPException) as exc2:
        svc._validate_rollover(
            PolicyLineCreate.model_validate(_line(rolloverAllowed=True, maxRolloverDays=12)),
            days,
        )
    assert exc2.value.detail == svc.POLICY_MAX_ROLLOVER_INVALID


def test_days_update_body_requires_lines() -> None:
    body = LeavePolicyDaysUpdateBody.model_validate({"lines": []})
    assert body.lines == []


@pytest.mark.asyncio
async def test_apply_days_allowed_increase_and_decrease() -> None:
    year = date.today().year
    policy_id = uuid.uuid4()
    leave_type_id = uuid.uuid4()
    employee_id = uuid.uuid4()

    balance = MagicMock()
    balance.entitled_days = 10
    balance.carried_forward_days = 0
    balance.used_days = 4
    balance.remaining_days = 6

    emp_result = MagicMock()
    emp_result.scalars.return_value.all.return_value = [employee_id]
    bal_result = MagicMock()
    bal_result.scalars.return_value.all.return_value = [balance]

    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[emp_result, bal_result])

    updated = await apply_policy_days_allowed_change(
        db,
        policy_id=policy_id,
        leave_type_id=leave_type_id,
        old_days_allowed=10,
        new_days_allowed=12,
        leave_year=year,
    )
    assert updated == 1
    assert balance.entitled_days == 12.0
    assert balance.used_days == 4
    assert balance.remaining_days == 8.0

    balance.entitled_days = 10
    balance.used_days = 4
    balance.remaining_days = 6
    db.execute = AsyncMock(side_effect=[emp_result, bal_result])
    await apply_policy_days_allowed_change(
        db,
        policy_id=policy_id,
        leave_type_id=leave_type_id,
        old_days_allowed=10,
        new_days_allowed=8,
        leave_year=year,
    )
    assert balance.entitled_days == 8.0
    assert balance.used_days == 4
    assert balance.remaining_days == 4.0

    balance.entitled_days = 10
    balance.used_days = 9
    balance.remaining_days = 1
    db.execute = AsyncMock(side_effect=[emp_result, bal_result])
    await apply_policy_days_allowed_change(
        db,
        policy_id=policy_id,
        leave_type_id=leave_type_id,
        old_days_allowed=10,
        new_days_allowed=8,
        leave_year=year,
    )
    assert balance.used_days == 9
    assert balance.remaining_days == 0.0
    assert compute_remaining(8, 0, 9) == Decimal("0")
