"""Holidays and leave days on the weekly timesheet (dayMarkers)."""

from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.modules.timesheet.day_markers import (
    day_markers_for_week,
    day_markers_for_weeks,
    holiday_marker,
    leave_marker,
)
from app.modules.timesheet.week_service import _header_to_dict

WEEK = date(2026, 9, 20)  # Sunday
NEXT_WEEK = date(2026, 9, 27)


def _holiday(day: date, name: str = "Founders' Day") -> MagicMock:
    row = MagicMock()
    row.holiday_date = day
    row.holiday_name = name
    row.holiday_type = "Company Holiday"
    return row


def _session(holidays: list, leave_rows: list) -> AsyncMock:
    holiday_result = MagicMock()
    holiday_result.scalars.return_value.all.return_value = holidays
    leave_result = MagicMock()
    leave_result.all.return_value = leave_rows
    session = AsyncMock()
    session.execute = AsyncMock(side_effect=[holiday_result, leave_result])
    return session


def _patch_company():
    return patch(
        "app.modules.timesheet.day_markers.resolve_org_master_company_id",
        new=AsyncMock(return_value=uuid4()),
    )


def test_holiday_marker_shape() -> None:
    assert holiday_marker(_holiday(date(2026, 9, 21))) == {
        "date": "2026-09-21",
        "kind": "holiday",
        "name": "Founders' Day",
        "holidayType": "Company Holiday",
    }


def test_leave_marker_shape() -> None:
    assert leave_marker(date(2026, 9, 25), "Sick Leave", "Approved", True) == {
        "date": "2026-09-25",
        "kind": "leave",
        "leaveType": "Sick Leave",
        "status": "Approved",
        "halfDay": True,
    }


@pytest.mark.asyncio
async def test_week_markers_include_holidays_and_leave() -> None:
    employee_id = uuid4()
    session = _session(
        [_holiday(date(2026, 9, 21))],
        [
            (employee_id, date(2026, 9, 23), False, "Approved", "Sick Leave"),
            (employee_id, date(2026, 9, 25), True, "Pending", "Personal Leave"),
        ],
    )
    with _patch_company():
        markers = await day_markers_for_week(session, {}, employee_id, WEEK)

    assert [(m["date"], m["kind"]) for m in markers] == [
        ("2026-09-21", "holiday"),
        ("2026-09-23", "leave"),
        ("2026-09-25", "leave"),
    ]
    assert markers[2]["status"] == "Pending"
    assert markers[2]["halfDay"] is True


@pytest.mark.asyncio
async def test_markers_split_by_employee_and_week() -> None:
    asha, ravi = uuid4(), uuid4()
    session = _session(
        [_holiday(date(2026, 9, 21)), _holiday(date(2026, 9, 28), "Other Day")],
        [
            (asha, date(2026, 9, 23), False, "Approved", "Sick Leave"),
            (ravi, date(2026, 9, 29), False, "Approved", "Personal Leave"),
        ],
    )
    with _patch_company():
        markers = await day_markers_for_weeks(
            session, {}, [(asha, WEEK), (ravi, NEXT_WEEK)]
        )

    assert [m["date"] for m in markers[(asha, WEEK)]] == ["2026-09-21", "2026-09-23"]
    assert [m["date"] for m in markers[(ravi, NEXT_WEEK)]] == ["2026-09-28", "2026-09-29"]


@pytest.mark.asyncio
async def test_no_weeks_skips_queries() -> None:
    session = AsyncMock()
    assert await day_markers_for_weeks(session, {}, []) == {}
    session.execute.assert_not_called()


def test_week_payload_carries_day_markers() -> None:
    header = MagicMock()
    header.lines = []
    header.week_start_date = WEEK
    header.week_end_date = date(2026, 9, 26)
    header.submitted_date = None
    header.approved_by = None
    header.approved_date = None
    marker = holiday_marker(_holiday(date(2026, 9, 21)))

    assert _header_to_dict(header, day_markers=[marker])["dayMarkers"] == [marker]
    assert _header_to_dict(header)["dayMarkers"] == []
