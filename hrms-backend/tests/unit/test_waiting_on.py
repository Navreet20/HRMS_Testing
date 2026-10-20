"""Who a pending item is waiting on, shown to the employee."""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.modules.workflow.waiting import FALLBACK, waiting_on_label


def _employee(manager_id):
    return SimpleNamespace(reporting_manager_id=manager_id)


@pytest.mark.asyncio
async def test_names_an_active_manager() -> None:
    manager = SimpleNamespace(first_name="Meena", last_name="P", status="ACTIVE")
    session = AsyncMock()
    session.get = AsyncMock(return_value=manager)
    assert await waiting_on_label(session, _employee(uuid.uuid4())) == "Meena P (your manager)"


@pytest.mark.asyncio
@pytest.mark.parametrize("case", ["no manager", "missing", "inactive"])
async def test_falls_back_to_hr_when_there_is_no_active_manager(case: str) -> None:
    session = AsyncMock()
    if case == "no manager":
        employee = _employee(None)
    else:
        employee = _employee(uuid.uuid4())
        session.get = AsyncMock(
            return_value=None
            if case == "missing"
            else SimpleNamespace(first_name="Old", last_name="Boss", status="INACTIVE")
        )
    assert await waiting_on_label(session, employee) == FALLBACK
