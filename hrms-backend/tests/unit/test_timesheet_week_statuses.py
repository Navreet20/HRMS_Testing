"""Week status dots for the timesheet month view."""

from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.modules.timesheet.week_service import list_my_week_statuses


def _session(rows):
    result = MagicMock()
    result.all.return_value = rows
    session = AsyncMock()
    session.execute = AsyncMock(return_value=result)
    return session


@pytest.mark.asyncio
async def test_lists_saved_weeks_and_skips_empty_drafts() -> None:
    session = _session(
        [
            (date(2026, 9, 6), "Draft", 0),
            (date(2026, 9, 13), "Approved", 2),
            (date(2026, 9, 20), "Draft", 1),
        ]
    )
    rows = await list_my_week_statuses(
        session, {"employeeId": str(uuid4())}, "2026-09-01", "2026-09-30"
    )
    assert rows == [
        {"weekStartDate": "2026-09-13", "status": "Approved"},
        {"weekStartDate": "2026-09-20", "status": "Draft"},
    ]


@pytest.mark.asyncio
async def test_rejects_ranges_longer_than_a_year() -> None:
    with pytest.raises(HTTPException) as exc:
        await list_my_week_statuses(
            _session([]), {"employeeId": str(uuid4())}, "2024-01-01", "2026-09-30"
        )
    assert exc.value.status_code == 400
