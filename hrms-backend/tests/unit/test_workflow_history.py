"""Who may read a timeline, and how it is listed."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.modules.workflow import events, router as wf

OWNER = uuid.uuid4()
MANAGER = uuid.uuid4()
OTHER = uuid.uuid4()


def _session(manager_id):
    result = MagicMock()
    result.scalar_one_or_none.return_value = manager_id
    session = MagicMock()
    session.execute = AsyncMock(return_value=result)
    return session


def _user(employee_id, role="EMPLOYEE"):
    return {"employeeId": str(employee_id), "role": role, "roles": [role]}


@pytest.mark.asyncio
async def test_the_owner_and_whoever_raised_it_can_read_it() -> None:
    owners = (OWNER, OTHER)
    assert await wf.can_view_history(_session(None), _user(OWNER), owners)
    assert await wf.can_view_history(_session(None), _user(OTHER), owners)


@pytest.mark.asyncio
async def test_the_employees_manager_and_hr_can_read_it_but_a_stranger_cannot() -> None:
    owners = (OWNER, None)
    assert await wf.can_view_history(_session(MANAGER), _user(MANAGER), owners)
    assert await wf.can_view_history(_session(MANAGER), _user(uuid.uuid4(), "HR"), owners)
    assert not await wf.can_view_history(_session(MANAGER), _user(uuid.uuid4()), owners)


@pytest.mark.asyncio
async def test_unknown_types_and_missing_items_are_404() -> None:
    with pytest.raises(HTTPException) as unknown:
        await wf.item_history(MagicMock(), _user(OWNER), "payroll", uuid.uuid4())
    assert unknown.value.status_code == 404

    result = MagicMock()
    result.first.return_value = None
    session = MagicMock()
    session.execute = AsyncMock(return_value=result)
    with pytest.raises(HTTPException) as missing:
        await wf.item_history(session, _user(OWNER), "timesheet", uuid.uuid4())
    assert missing.value.status_code == 404


def test_events_serialise_for_the_timeline() -> None:
    row = SimpleNamespace(
        event_id=uuid.uuid4(),
        event="rejected",
        actor_name="Meena P",
        comment="Wrong project",
        created_date=datetime(2026, 9, 20, 10, 0, tzinfo=timezone.utc),
    )
    assert events.event_to_dict(row) == {
        "eventId": str(row.event_id),
        "event": "rejected",
        "actorName": "Meena P",
        "comment": "Wrong project",
        "createdDate": "2026-09-20T10:00:00+00:00",
    }


def test_comments_are_trimmed_to_fit_the_column() -> None:
    session = MagicMock()
    events.record_event(
        session,
        item_type="leave",
        item_id=uuid.uuid4(),
        event="rejected",
        user={"employeeId": str(OWNER), "firstName": "Meena", "lastName": "P"},
        comment="x" * 400,
    )
    row = session.add.call_args.args[0]
    assert len(row.comment) == 255
    assert row.actor_name == "Meena P"
