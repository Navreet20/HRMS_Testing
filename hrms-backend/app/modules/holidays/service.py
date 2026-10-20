"""Company holidays against the 37-table schema (no company_id / year column)."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import extract, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.role_groups import LEAVE_ADMIN_ROLES
from app.core.roles import session_access_roles
from app.models.tables import CompanyHoliday, LeaveRequest, LeaveRequestDay
from app.modules.holidays.schemas import HolidayBody
from app.modules.leave.constants import LEAVE_STATUS_APPROVED, LEAVE_STATUS_PENDING

_LEAVE_ADMIN_ROLE_VALUES = {role.value for role in LEAVE_ADMIN_ROLES}

HOLIDAY_YEAR_NOT_ALLOWED = "Holidays can only be added for the current year or next year"
HOLIDAY_DATE_OUTSIDE_YEAR = "Holiday date must fall within the selected holiday year"
HOLIDAY_DUPLICATE_DATE = "A holiday already exists on this date"
HOLIDAY_YEAR_FORBIDDEN = "Only the current year's holiday list is available"
HOLIDAY_PAST_CANNOT_DELETE = (
    "Past holidays can't be deleted: leave and timesheets were already counted around them."
)


def _actor_name(actor: dict[str, Any]) -> str:
    return f"{actor.get('firstName', '')} {actor.get('lastName', '')}".strip()


def is_leave_admin(actor: dict[str, Any]) -> bool:
    return bool(session_access_roles(actor).intersection(_LEAVE_ADMIN_ROLE_VALUES))


def day_of_week_for(value: date) -> str:
    return value.strftime("%A")


def holiday_to_dict(row: CompanyHoliday, *, company_id: uuid.UUID | None = None) -> dict[str, Any]:
    return {
        "holidayId": str(row.id),
        "companyId": str(company_id) if company_id else None,
        "holidayYear": row.holiday_date.year,
        "holidayName": row.name,
        "holidayType": row.holiday_type,
        "holidayDate": row.holiday_date.isoformat(),
        "dayOfWeek": day_of_week_for(row.holiday_date),
    }


def _validate_body(body: HolidayBody, *, today: date | None = None) -> None:
    current_year = (today or date.today()).year
    if body.holiday_year not in (current_year, current_year + 1):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=HOLIDAY_YEAR_NOT_ALLOWED)
    if body.holiday_date.year != body.holiday_year:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=HOLIDAY_DATE_OUTSIDE_YEAR)


async def _assert_date_available(
    db: AsyncSession,
    body: HolidayBody,
    *,
    exclude_holiday_id: uuid.UUID | None = None,
) -> None:
    stmt = select(CompanyHoliday.id).where(CompanyHoliday.holiday_date == body.holiday_date)
    if exclude_holiday_id is not None:
        stmt = stmt.where(CompanyHoliday.id != exclude_holiday_id)
    if (await db.execute(stmt)).scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=HOLIDAY_DUPLICATE_DATE)


async def _flush_or_conflict(db: AsyncSession) -> None:
    try:
        await db.flush()
    except IntegrityError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=HOLIDAY_DUPLICATE_DATE) from exc


def _day_value(day: LeaveRequestDay) -> Decimal:
    part = getattr(day, "half_part", None) or "full"
    if part in ("first", "second"):
        return Decimal("0.5")
    return Decimal("1")


async def recalculate_requests_for_holiday(db: AsyncSession, holiday_date: date) -> int:
    """Drop the holiday from existing leave requests covering it."""
    result = await db.execute(
        select(LeaveRequest)
        .join(LeaveRequestDay, LeaveRequestDay.leave_request_id == LeaveRequest.id)
        .where(
            LeaveRequestDay.leave_date == holiday_date,
            LeaveRequest.status.in_((LEAVE_STATUS_PENDING, LEAVE_STATUS_APPROVED)),
        )
        .options(selectinload(LeaveRequest.days))
    )
    requests = result.scalars().unique().all()
    for request in requests:
        removed = [day for day in list(request.days) if day.leave_date == holiday_date]
        for day in removed:
            await db.delete(day)
        # total days are derived from day rows in the new schema when present
        if hasattr(request, "total_days"):
            remaining = [d for d in request.days if d.leave_date != holiday_date]
            request.total_days = float(sum((_day_value(d) for d in remaining), Decimal("0")))
    if requests:
        await db.flush()
    return len(requests)


def _leave_requests_covering(holiday_date: date):
    return (
        select(LeaveRequest)
        .where(
            LeaveRequest.from_date <= holiday_date,
            LeaveRequest.to_date >= holiday_date,
            LeaveRequest.status.in_((LEAVE_STATUS_PENDING, LEAVE_STATUS_APPROVED)),
        )
        .options(selectinload(LeaveRequest.days))
    )


async def restore_requests_for_deleted_holiday(db: AsyncSession, holiday_date: date) -> int:
    if holiday_date.weekday() >= 5:
        return 0
    requests = (await db.execute(_leave_requests_covering(holiday_date))).scalars().unique().all()
    changed = 0
    for request in requests:
        if any(day.leave_date == holiday_date for day in request.days):
            continue
        day = LeaveRequestDay(
            leave_request_id=request.id,
            leave_date=holiday_date,
            half_part="full",
        )
        db.add(day)
        changed += 1
    if changed:
        await db.flush()
    return changed


async def _get_holiday(db: AsyncSession, holiday_id: uuid.UUID) -> CompanyHoliday:
    row = (
        await db.execute(select(CompanyHoliday).where(CompanyHoliday.id == holiday_id))
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Holiday not found")
    return row


async def holiday_delete_impact(
    db: AsyncSession, actor: dict[str, Any], holiday_id: uuid.UUID
) -> dict[str, Any]:
    _ = actor
    row = await _get_holiday(db, holiday_id)
    affected = 0
    if row.holiday_date.weekday() < 5:
        try:
            requests = (await db.execute(_leave_requests_covering(row.holiday_date))).scalars().unique().all()
            affected = sum(
                1 for r in requests if all(d.leave_date != row.holiday_date for d in r.days)
            )
        except Exception:
            affected = 0
    return {
        "holidayId": str(row.id),
        "canDelete": row.holiday_date >= date.today(),
        "leaveRequestsAffected": affected,
    }


async def delete_holiday(
    db: AsyncSession, actor: dict[str, Any], holiday_id: uuid.UUID
) -> dict[str, Any]:
    _ = actor
    row = await _get_holiday(db, holiday_id)
    if row.holiday_date < date.today():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=HOLIDAY_PAST_CANNOT_DELETE)
    restored = await restore_requests_for_deleted_holiday(db, row.holiday_date)
    await db.delete(row)
    await db.flush()
    return {"holidayId": str(holiday_id), "leaveRequestsUpdated": restored}


async def list_holidays(
    db: AsyncSession, actor: dict[str, Any], year: int | None = None
) -> list[dict[str, Any]]:
    current_year = date.today().year
    target_year = year or current_year
    allowed_years = (current_year, current_year + 1) if is_leave_admin(actor) else (current_year,)
    if target_year not in allowed_years:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=HOLIDAY_YEAR_FORBIDDEN)
    result = await db.execute(
        select(CompanyHoliday)
        .where(extract("year", CompanyHoliday.holiday_date) == target_year)
        .order_by(CompanyHoliday.holiday_date)
    )
    return [holiday_to_dict(row) for row in result.scalars().all()]


async def create_holiday(
    db: AsyncSession, actor: dict[str, Any], body: HolidayBody
) -> dict[str, Any]:
    _ = actor
    _validate_body(body)
    await _assert_date_available(db, body)
    row = CompanyHoliday(
        name=body.holiday_name,
        holiday_type=body.holiday_type,
        holiday_date=body.holiday_date,
    )
    db.add(row)
    await _flush_or_conflict(db)
    try:
        await recalculate_requests_for_holiday(db, row.holiday_date)
    except Exception:
        pass  # leave request port may still be mid-flight
    return holiday_to_dict(row)


async def update_holiday(
    db: AsyncSession, actor: dict[str, Any], holiday_id: uuid.UUID, body: HolidayBody
) -> dict[str, Any]:
    _ = actor
    _validate_body(body)
    row = await _get_holiday(db, holiday_id)
    await _assert_date_available(db, body, exclude_holiday_id=row.id)
    date_changed = row.holiday_date != body.holiday_date
    row.name = body.holiday_name
    row.holiday_type = body.holiday_type
    row.holiday_date = body.holiday_date
    await _flush_or_conflict(db)
    if date_changed:
        try:
            await recalculate_requests_for_holiday(db, row.holiday_date)
        except Exception:
            pass
    return holiday_to_dict(row)
