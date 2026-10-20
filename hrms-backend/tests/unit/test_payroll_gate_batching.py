"""Payroll gate: banks for many employees come from one query, newest primary wins."""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.modules.onboarding.enums import BankAccountStatus
from app.modules.onboarding.payroll_gate import (
    block_reason_for_bank,
    primary_banks_by_employee,
)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_one_query_and_newest_primary_wins():
    first, second = uuid.uuid4(), uuid.uuid4()
    newest = SimpleNamespace(employee_id=first, status=BankAccountStatus.VERIFIED)
    older = SimpleNamespace(employee_id=first, status="REJECTED")
    other = SimpleNamespace(employee_id=second, status=BankAccountStatus.VERIFIED)
    result = MagicMock()
    result.scalars.return_value.all.return_value = [newest, older, other]
    session = MagicMock()
    session.execute = AsyncMock(return_value=result)

    banks = await primary_banks_by_employee(session, [first, second])

    assert session.execute.await_count == 1
    assert banks[first] is newest and banks[second] is other
    assert await primary_banks_by_employee(session, []) == {}
    assert session.execute.await_count == 1


@pytest.mark.unit
def test_block_reasons():
    assert block_reason_for_bank(None) == "No primary bank account on file"
    assert block_reason_for_bank(SimpleNamespace(status="PENDING")) == (
        "Primary bank account is PENDING"
    )
    assert block_reason_for_bank(SimpleNamespace(status=BankAccountStatus.VERIFIED)) is None
