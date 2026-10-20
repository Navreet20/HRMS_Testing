"""Working-day expansion for leave requests.

Weekends (Saturday and Sunday for everyone) and company holidays are skipped;
each remaining date becomes one LeaveRequestDay worth 1.0, or 0.5 when marked
as a half day. Every day carries its own leave_year so year-crossing requests
deduct from the right balance.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from typing import Iterable, Mapping

FULL_DAY = Decimal("1.0")
HALF_DAY = Decimal("0.5")
FIRST_HALF = "first"
SECOND_HALF = "second"
_SATURDAY = 5


@dataclass(frozen=True)
class DayRow:
    leave_date: date
    is_half_day: bool
    day_value: Decimal
    # Which half is taken on a half day; None on a full day.
    half_part: str | None = None

    @property
    def leave_year(self) -> int:
        return self.leave_date.year


def working_dates(from_date: date, to_date: date, holidays: Iterable[date]) -> list[date]:
    holiday_set = set(holidays)
    days: list[date] = []
    current = from_date
    while current <= to_date:
        if current.weekday() < _SATURDAY and current not in holiday_set:
            days.append(current)
        current += timedelta(days=1)
    return days


def build_day_rows(
    dates: Iterable[date],
    half_days: Iterable[date],
    half_parts: Mapping[date, str] | None = None,
) -> list[DayRow]:
    """One row per date. A half day takes the first half unless `half_parts` says otherwise."""
    parts = half_parts or {}
    half_set = set(half_days) | set(parts)
    return [
        DayRow(
            leave_date=value,
            is_half_day=value in half_set,
            day_value=HALF_DAY if value in half_set else FULL_DAY,
            half_part=(parts.get(value) or FIRST_HALF) if value in half_set else None,
        )
        for value in dates
    ]


def total_days(rows: Iterable[DayRow]) -> Decimal:
    return sum((row.day_value for row in rows), Decimal("0"))


def days_by_year(rows: Iterable[DayRow]) -> dict[int, Decimal]:
    totals: dict[int, Decimal] = {}
    for row in rows:
        totals[row.leave_year] = totals.get(row.leave_year, Decimal("0")) + row.day_value
    return totals
