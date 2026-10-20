"""Holidays and leave days shown on the weekly timesheet grid.

Each week payload carries ``dayMarkers``: the company holidays in that week and
the employee's Pending or Approved leave days. They only label and colour the
day columns; nothing here blocks or fills hours.
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from typing import Any, Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tables import CompanyHoliday, LeaveRequest, LeaveRequestDay, LeaveType
from app.modules.leave.constants import LEAVE_STATUS_APPROVED, LEAVE_STATUS_PENDING
from app.modules.org.service import resolve_org_master_company_id

MARKER_HOLIDAY = "holiday"
MARKER_LEAVE = "leave"

WeekKey = tuple[uuid.UUID, date]


def holiday_marker(row: CompanyHoliday) -> dict[str, Any]:
    return {
        "date": row.holiday_date.isoformat(),
        "kind": MARKER_HOLIDAY,
        "name": row.holiday_name,
        "holidayType": row.holiday_type,
    }


def leave_marker(
    leave_date: date, leave_type_name: str, status: str, is_half_day: bool
) -> dict[str, Any]:
    return {
        "date": leave_date.isoformat(),
        "kind": MARKER_LEAVE,
        "leaveType": leave_type_name,
        "status": status,
        "halfDay": bool(is_half_day),
    }


async def day_markers_for_weeks(
    session: AsyncSession, user: dict[str, Any], weeks: Iterable[WeekKey]
) -> dict[WeekKey, list[dict[str, Any]]]:
    """Markers for several (employee, week start) pairs in two queries."""
    keys = list(dict.fromkeys(weeks))
    markers: dict[WeekKey, list[dict[str, Any]]] = {key: [] for key in keys}
    if not keys:
        return markers
    first = min(week_start for _, week_start in keys)
    last = max(week_start for _, week_start in keys) + timedelta(days=6)

    _ = user
    holidays = (
        await session.execute(
            select(CompanyHoliday)
            .where(
                CompanyHoliday.holiday_date >= first,
                CompanyHoliday.holiday_date <= last,
            )
            .order_by(CompanyHoliday.holiday_date)
        )
    ).scalars().all()

    employee_ids = {employee_id for employee_id, _ in keys}
    leave_rows = (
        await session.execute(
            select(
                LeaveRequest.employee_id,
                LeaveRequestDay.leave_date,
                LeaveRequestDay.half_part,
                LeaveRequest.status,
                LeaveType.leave_type_name,
            )
            .join(LeaveRequest, LeaveRequest.leave_request_id == LeaveRequestDay.leave_request_id)
            .join(LeaveType, LeaveType.leave_type_id == LeaveRequest.leave_type_id)
            .where(
                LeaveRequest.employee_id.in_(employee_ids),
                LeaveRequest.status.in_((LEAVE_STATUS_PENDING, LEAVE_STATUS_APPROVED)),
                LeaveRequestDay.leave_date >= first,
                LeaveRequestDay.leave_date <= last,
            )
            .order_by(LeaveRequestDay.leave_date)
        )
    ).all()

    for employee_id, week_start in keys:
        week_end = week_start + timedelta(days=6)
        week_markers = markers[(employee_id, week_start)]
        week_markers.extend(
            holiday_marker(row)
            for row in holidays
            if week_start <= row.holiday_date <= week_end
        )
        week_markers.extend(
            leave_marker(
                leave_date,
                type_name,
                status,
                half_part in ("first", "second"),
            )
            for owner_id, leave_date, half_part, status, type_name in leave_rows
            if owner_id == employee_id and week_start <= leave_date <= week_end
        )
    return markers


async def day_markers_for_week(
    session: AsyncSession, user: dict[str, Any], employee_id: uuid.UUID, week_start: date
) -> list[dict[str, Any]]:
    key = (employee_id, week_start)
    return (await day_markers_for_weeks(session, user, [key]))[key]
