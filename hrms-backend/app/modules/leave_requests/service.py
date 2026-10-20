"""Employee leave requests: preview, submit, recall, resubmit, delete, history.

Requests stay Pending until a manager acts. A recalled request keeps its row
(``recalled_at`` set) but is out of the manager queue and history until the
employee resubmits it (same id) or deletes it.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.workflow.waiting import waiting_on_label
from app.modules.workflow.events import (
    EVENT_RECALLED,
    EVENT_REOPENED,
    EVENT_RESUBMITTED,
    EVENT_SUBMITTED,
    ITEM_LEAVE,
    record_event,
)
from app.models.tables import (
    CompanyHoliday,
    Employee,
    LeaveBalance,
    LeavePolicyLine,
    LeaveRequest,
    LeaveRequestDay,
    LeaveType,
)
from app.modules.leave.balance_service import ensure_year_balances
from app.modules.leave.constants import (
    LEAVE_STATUS_APPROVED,
    LEAVE_STATUS_PENDING,
    LEAVE_STATUS_REJECTED,
    MASTER_STATUS_ACTIVE,
    UNPAID_LEAVE_TYPE_NAME,
)
from app.modules.leave_requests.days import (
    FIRST_HALF,
    DayRow,
    build_day_rows,
    days_by_year,
    total_days,
    working_dates,
)
from app.modules.leave_requests.notify import notify_manager_leave_submitted
from app.modules.leave_requests.schemas import LeavePreviewBody, LeaveRequestBody
from app.modules.org.service import resolve_org_master_company_id

HISTORY_STATUSES = (LEAVE_STATUS_PENDING, LEAVE_STATUS_APPROVED, LEAVE_STATUS_REJECTED)
OVERLAP_STATUSES = (LEAVE_STATUS_PENDING, LEAVE_STATUS_APPROVED)

TO_BEFORE_FROM = "To date cannot be before From date"
PREVIOUS_YEAR = "Leave cannot be requested for a previous year"
BEFORE_JOINING = "Leave cannot start before your joining date"
NO_WORKING_DAYS = "The selected dates have no working days (only weekends or holidays)"
MAX_REQUEST_DAYS = 366
RANGE_TOO_LONG = "A request can cover at most 366 days"
TOO_FAR_AHEAD = "Leave can only be requested up to a year ahead"
TYPE_NOT_AVAILABLE = "This leave type is not available"
TYPE_NOT_IN_POLICY = "This leave type is not part of your leave policy"


def _today() -> date:
    return date.today()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_float(value: Decimal | float | int | None) -> float:
    return float(Decimal(str(value or 0)).quantize(Decimal("0.1")))


def _employee_uuid(user: dict[str, Any]) -> uuid.UUID:
    raw = user.get("employeeId") or user.get("id")
    if not raw:
        raise HTTPException(status_code=400, detail="Authenticated user has no employee id")
    try:
        return uuid.UUID(str(raw))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Authenticated user has no employee id") from exc


async def _load_employee(db: AsyncSession, user: dict[str, Any]) -> Employee:
    employee = await db.get(Employee, _employee_uuid(user))
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    return employee


async def _ensure_current_year_balances(db: AsyncSession, employee: Employee) -> None:
    """Create this year's balances on first use (LEAVE-DATA-6).

    The Jan 1 grant job normally creates them; this keeps leave working in
    January even if that job has not run yet. Existing rows are left as is.
    """
    if employee.leave_policy_id is None:
        return
    await ensure_year_balances(db, employee.employee_id, _today().year)


def _join_date(employee: Employee) -> date | None:
    raw = str(employee.employment_start_date or "")[:10]
    try:
        return date.fromisoformat(raw)
    except ValueError:
        return None


def validate_dates(
    from_date: date, to_date: date, *, join_date: date | None, today: date
) -> None:
    if to_date < from_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=TO_BEFORE_FROM)
    if from_date.year < today.year:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=PREVIOUS_YEAR)
    if join_date is not None and join_date.year == today.year and from_date < join_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=BEFORE_JOINING)
    # A sanity limit, so a mistyped year cannot build thousands of day rows.
    if (to_date - from_date).days + 1 > MAX_REQUEST_DAYS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=RANGE_TOO_LONG)
    if (from_date - today).days > MAX_REQUEST_DAYS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=TOO_FAR_AHEAD)


async def _active_leave_type(db: AsyncSession, leave_type_id: uuid.UUID) -> LeaveType:
    leave_type = await db.get(LeaveType, leave_type_id)
    # New schema leave_types are a fixed catalog (no status column).
    if leave_type is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=TYPE_NOT_AVAILABLE)
    _ = MASTER_STATUS_ACTIVE  # kept for callers/docs that still mention Active
    return leave_type


def _is_unpaid(leave_type: LeaveType) -> bool:
    return leave_type.leave_type_name == UNPAID_LEAVE_TYPE_NAME


async def _holiday_dates(
    db: AsyncSession, actor: dict[str, Any], from_date: date, to_date: date
) -> list[date]:
    _ = actor
    result = await db.execute(
        select(CompanyHoliday.holiday_date).where(
            CompanyHoliday.holiday_date >= from_date,
            CompanyHoliday.holiday_date <= to_date,
        )
    )
    return list(result.scalars().all())


async def _available_by_year(
    db: AsyncSession, employee: Employee, leave_type: LeaveType, years: list[int]
) -> dict[int, Decimal]:
    """Remaining days per leave year for a paid type.

    Uses the year's balance row; a future year without a row yet is projected
    from the employee's policy line (the annual grant creates the real row).
    """
    if _today().year in years:
        await _ensure_current_year_balances(db, employee)
    available: dict[int, Decimal] = {}
    policy_days: Decimal | None = None
    if employee.leave_policy_id is not None:
        line = (
            await db.execute(
                select(LeavePolicyLine).where(
                    LeavePolicyLine.policy_id == employee.leave_policy_id,
                    LeavePolicyLine.leave_type_id == leave_type.leave_type_id,
                )
            )
        ).scalar_one_or_none()
        if line is not None:
            policy_days = Decimal(str(line.days_allowed))

    for year in years:
        balance = (
            await db.execute(
                select(LeaveBalance).where(
                    LeaveBalance.employee_id == employee.employee_id,
                    LeaveBalance.leave_type_id == leave_type.leave_type_id,
                    LeaveBalance.leave_year == year,
                )
            )
        ).scalar_one_or_none()
        if balance is not None:
            # New schema stores entitled + carried; remaining is view-derived.
            remaining = getattr(balance, "remaining_days", None)
            if remaining is None:
                entitled = Decimal(str(balance.entitled_days or 0))
                carried = Decimal(str(balance.carried_forward_days or 0))
                remaining = entitled + carried
            available[year] = Decimal(str(remaining))
        elif policy_days is not None and year > _today().year:
            available[year] = policy_days
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=TYPE_NOT_IN_POLICY)
    return available


def _halves_clash(new: DayRow, existing_is_half: bool, existing_part: str | None) -> bool:
    """Two leaves on one day clash unless both are half days on different halves."""
    if not new.is_half_day or not existing_is_half:
        return True
    return (new.half_part or FIRST_HALF) == (existing_part or FIRST_HALF)


async def _overlapping_requests(
    db: AsyncSession,
    employee_id: uuid.UUID,
    rows: list[DayRow],
    exclude_request_id: uuid.UUID | None = None,
) -> list[dict[str, Any]]:
    """Existing pending or approved requests that already use one of these days (or half days)."""
    if not rows:
        return []
    by_date = {row.leave_date: row for row in rows}
    stmt = (
        select(LeaveRequest, LeaveType.leave_type_name, LeaveRequestDay)
        .join(LeaveType, LeaveType.leave_type_id == LeaveRequest.leave_type_id)
        .join(LeaveRequestDay, LeaveRequestDay.leave_request_id == LeaveRequest.leave_request_id)
        .where(
            LeaveRequest.employee_id == employee_id,
            LeaveRequest.status.in_(OVERLAP_STATUSES),
            LeaveRequest.recalled_at.is_(None),
            LeaveRequestDay.leave_date.in_(list(by_date)),
        )
        .order_by(LeaveRequest.from_date, LeaveRequestDay.leave_date)
    )
    if exclude_request_id is not None:
        stmt = stmt.where(LeaveRequest.leave_request_id != exclude_request_id)
    found: dict[uuid.UUID, dict[str, Any]] = {}
    for request, type_name, day in (await db.execute(stmt)).all():
        existing_half = day.half_part in ("first", "second")
        if not _halves_clash(by_date[day.leave_date], existing_half, day.half_part):
            continue
        entry = found.setdefault(
            request.leave_request_id,
            {
                "leaveRequestId": str(request.leave_request_id),
                "leaveTypeName": type_name,
                "fromDate": request.from_date.isoformat(),
                "toDate": request.to_date.isoformat(),
                "status": request.status,
                "clashDates": [],
            },
        )
        entry["clashDates"].append(day.leave_date.isoformat())
    return list(found.values())


def overlap_message(overlaps: list[dict[str, Any]]) -> str | None:
    """Words for a request that double-books days, or None when nothing clashes."""
    if not overlaps:
        return None
    parts = []
    for item in overlaps:
        dates = [date.fromisoformat(value) for value in item["clashDates"]]
        first = f"{dates[0]:%b} {dates[0].day}"
        span = first if len(dates) == 1 else f"{first} to {dates[-1]:%b} {dates[-1].day} ({len(dates)} days)"
        parts.append(f"{item['leaveTypeName']} ({item['status']}) on {span}")
    return (
        "You already have " + "; ".join(parts) + ". Recall it first or pick other dates. "
        "Only a first half and a second half can share a day."
    )


def _shortfall_message(
    leave_type: LeaveType, requested: dict[int, Decimal], available: dict[int, Decimal]
) -> str | None:
    parts = []
    for year in sorted(requested):
        have = available.get(year, Decimal("0"))
        if requested[year] > have:
            parts.append(f"{_as_float(have):g} days of {leave_type.leave_type_name} available in {year}")
    if not parts:
        return None
    return (
        "Only " + " and ".join(parts) + ". Move the remaining days to another leave "
        "type with balance (for example Unpaid Leave) and submit them as a separate request."
    )


async def _evaluate(
    db: AsyncSession,
    actor: dict[str, Any],
    employee: Employee,
    body: LeaveRequestBody,
    *,
    exclude_request_id: uuid.UUID | None = None,
) -> dict[str, Any]:
    validate_dates(body.from_date, body.to_date, join_date=_join_date(employee), today=_today())
    leave_type = await _active_leave_type(db, body.leave_type_id)
    holidays = await _holiday_dates(db, actor, body.from_date, body.to_date)
    rows = build_day_rows(
        working_dates(body.from_date, body.to_date, holidays), body.half_days, body.half_day_parts
    )
    requested = days_by_year(rows)
    unpaid = _is_unpaid(leave_type)
    available = (
        {} if unpaid else await _available_by_year(db, employee, leave_type, sorted(requested))
    )
    overlaps = await _overlapping_requests(db, employee.employee_id, rows, exclude_request_id)
    return {
        "leave_type": leave_type,
        "rows": rows,
        "requested": requested,
        "available": available,
        "unpaid": unpaid,
        "overlaps": overlaps,
        "shortfall": None if unpaid else _shortfall_message(leave_type, requested, available),
    }


def _day_row_to_dict(row: DayRow) -> dict[str, Any]:
    return {
        "leaveDate": row.leave_date.isoformat(),
        "dayOfWeek": row.leave_date.strftime("%A"),
        "isHalfDay": row.is_half_day,
        "halfPart": row.half_part,
        "dayValue": _as_float(row.day_value),
        "leaveYear": row.leave_year,
    }


async def preview_request(
    db: AsyncSession, actor: dict[str, Any], body: LeavePreviewBody
) -> dict[str, Any]:
    employee = await _load_employee(db, actor)
    result = await _evaluate(db, actor, employee, body, exclude_request_id=body.exclude_request_id)
    return {
        "leaveTypeId": str(result["leave_type"].leave_type_id),
        "leaveTypeName": result["leave_type"].leave_type_name,
        "unlimited": result["unpaid"],
        "days": [_day_row_to_dict(row) for row in result["rows"]],
        "leaveDays": _as_float(total_days(result["rows"])),
        "balances": [
            {
                "leaveYear": year,
                "requestedDays": _as_float(result["requested"][year]),
                "availableDays": _as_float(result["available"].get(year)),
            }
            for year in sorted(result["requested"])
            if not result["unpaid"]
        ],
        "exceedsBalance": result["shortfall"] is not None,
        "shortfallMessage": result["shortfall"],
        "overlaps": result["overlaps"],
        "overlapMessage": overlap_message(result["overlaps"]),
    }


def _assert_submittable(result: dict[str, Any]) -> None:
    if not result["rows"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=NO_WORKING_DAYS)
    clash = overlap_message(result["overlaps"])
    if clash is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=clash)
    if result["shortfall"] is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["shortfall"])


def _half_part_for_row(row: DayRow) -> str:
    if getattr(row, "is_half_day", False):
        part = getattr(row, "half_part", None) or FIRST_HALF
        return "first" if part in (FIRST_HALF, "first", "AM") else "second"
    return "full"


def _day_value_from_part(half_part: str | None) -> float:
    return 0.5 if half_part in ("first", "second") else 1.0


def _replace_days(request: LeaveRequest, rows: list[DayRow]) -> None:
    request.days.clear()
    for row in rows:
        request.days.append(
            LeaveRequestDay(
                leave_date=row.leave_date,
                half_part=_half_part_for_row(row),
            )
        )
    # New schema has no leave_days column; computed in request_to_dict.


def request_to_dict(request: LeaveRequest, leave_type_name: str) -> dict[str, Any]:
    day_rows = sorted(request.days, key=lambda d: d.leave_date)
    leave_days = sum(_day_value_from_part(getattr(d, "half_part", "full")) for d in day_rows)
    decided_at = getattr(request, "decided_at", None) or getattr(request, "action_date", None)
    return {
        "leaveRequestId": str(request.leave_request_id),
        "employeeId": str(request.employee_id),
        "leaveTypeId": str(request.leave_type_id),
        "leaveTypeName": leave_type_name,
        "fromDate": request.from_date.isoformat(),
        "toDate": request.to_date.isoformat(),
        "leaveDays": float(leave_days),
        "reason": request.reason,
        "status": request.status,
        "submittedDate": request.submitted_date.isoformat() if request.submitted_date else None,
        "actionDate": decided_at.isoformat() if decided_at else None,
        "rejectionReason": request.rejection_reason,
        "rejectedAfterApproval": False,
        "recalled": request.recalled_at is not None,
        "days": [
            {
                "leaveDate": day.leave_date.isoformat(),
                "isHalfDay": day.half_part in ("first", "second"),
                "halfPart": day.half_part if day.half_part in ("first", "second") else None,
                "dayValue": _day_value_from_part(day.half_part),
                "leaveYear": day.leave_date.year,
            }
            for day in day_rows
        ],
    }


async def submit_request(
    db: AsyncSession, actor: dict[str, Any], body: LeaveRequestBody
) -> dict[str, Any]:
    employee = await _load_employee(db, actor)
    result = await _evaluate(db, actor, employee, body)
    _assert_submittable(result)
    request = LeaveRequest(
        employee_id=employee.employee_id,
        leave_type_id=body.leave_type_id,
        from_date=body.from_date,
        to_date=body.to_date,
        reason=body.reason,
        status=LEAVE_STATUS_PENDING,
        submitted_at=_now(),
        days=[],
    )
    _replace_days(request, result["rows"])
    db.add(request)
    await db.flush()
    record_event(
        db,
        item_type=ITEM_LEAVE,
        item_id=request.leave_request_id,
        event=EVENT_SUBMITTED,
        user=actor,
    )
    payload = request_to_dict(request, result["leave_type"].leave_type_name)
    await notify_manager_leave_submitted(
        db,
        employee=employee,
        manager_id=getattr(employee, "reporting_manager_id", None),
        leave_type_name=result["leave_type"].leave_type_name,
        from_date=request.from_date,
        to_date=request.to_date,
        leave_days=payload["leaveDays"],
    )
    return payload


async def _load_own_request(
    db: AsyncSession, employee_id: uuid.UUID, leave_request_id: uuid.UUID
) -> tuple[LeaveRequest, str]:
    row = (
        await db.execute(
            select(LeaveRequest, LeaveType.leave_type_name)
            .join(LeaveType, LeaveType.leave_type_id == LeaveRequest.leave_type_id)
            .where(
                LeaveRequest.leave_request_id == leave_request_id,
                LeaveRequest.employee_id == employee_id,
            )
            .options(selectinload(LeaveRequest.days))
        )
    ).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found")
    return row[0], row[1]


def _assert_recalled(request: LeaveRequest) -> None:
    if request.recalled_at is None or request.status != LEAVE_STATUS_PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only a recalled request can be resubmitted or deleted",
        )


async def get_own_request(
    db: AsyncSession, actor: dict[str, Any], leave_request_id: uuid.UUID
) -> dict[str, Any]:
    request, type_name = await _load_own_request(db, _employee_uuid(actor), leave_request_id)
    return request_to_dict(request, type_name)


async def recall_request(
    db: AsyncSession, actor: dict[str, Any], leave_request_id: uuid.UUID
) -> dict[str, Any]:
    request, type_name = await _load_own_request(db, _employee_uuid(actor), leave_request_id)
    if request.status != LEAVE_STATUS_PENDING or request.recalled_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only a Pending request can be recalled",
        )
    request.recalled_at = _now()
    record_event(
        db,
        item_type=ITEM_LEAVE,
        item_id=request.leave_request_id,
        event=EVENT_RECALLED,
        user=actor,
    )
    await db.flush()
    return request_to_dict(request, type_name)


async def reopen_rejected_request(
    db: AsyncSession, actor: dict[str, Any], leave_request_id: uuid.UUID
) -> dict[str, Any]:
    """Rejected → Recalled, so the employee can edit it and submit again.

    A rejected request holds no balance, so nothing needs undoing. The rejection
    and its comment stay on the request's timeline.
    """
    request, type_name = await _load_own_request(db, _employee_uuid(actor), leave_request_id)
    if request.status != LEAVE_STATUS_REJECTED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only a Rejected request can be reopened",
        )
    request.status = LEAVE_STATUS_PENDING
    request.recalled_at = _now()
    record_event(
        db,
        item_type=ITEM_LEAVE,
        item_id=request.leave_request_id,
        event=EVENT_REOPENED,
        user=actor,
    )
    await db.flush()
    return request_to_dict(request, type_name)


async def resubmit_request(
    db: AsyncSession,
    actor: dict[str, Any],
    leave_request_id: uuid.UUID,
    body: LeaveRequestBody,
) -> dict[str, Any]:
    employee = await _load_employee(db, actor)
    request, _ = await _load_own_request(db, employee.employee_id, leave_request_id)
    _assert_recalled(request)
    result = await _evaluate(db, actor, employee, body, exclude_request_id=request.leave_request_id)
    _assert_submittable(result)
    request.leave_type_id = body.leave_type_id
    request.from_date = body.from_date
    request.to_date = body.to_date
    request.reason = body.reason
    request.submitted_at = _now()
    request.recalled_at = None
    # Fresh submission: clear prior decision fields.
    request.rejection_reason = None
    request.decided_at = None
    request.decided_by_employee_id = None
    record_event(
        db,
        item_type=ITEM_LEAVE,
        item_id=request.leave_request_id,
        event=EVENT_RESUBMITTED,
        user=actor,
    )
    # Delete old day rows first so re-used dates don't hit the (request, date) unique key.
    for day in list(request.days):
        await db.delete(day)
    request.days.clear()
    await db.flush()
    _replace_days(request, result["rows"])
    await db.flush()
    payload = request_to_dict(request, result["leave_type"].leave_type_name)
    await notify_manager_leave_submitted(
        db,
        employee=employee,
        manager_id=getattr(employee, "reporting_manager_id", None),
        leave_type_name=result["leave_type"].leave_type_name,
        from_date=request.from_date,
        to_date=request.to_date,
        leave_days=payload["leaveDays"],
        resubmitted=True,
    )
    return payload


async def delete_recalled_request(
    db: AsyncSession, actor: dict[str, Any], leave_request_id: uuid.UUID
) -> None:
    request, _ = await _load_own_request(db, _employee_uuid(actor), leave_request_id)
    _assert_recalled(request)
    await db.delete(request)
    await db.flush()


async def list_own_requests(
    db: AsyncSession,
    actor: dict[str, Any],
    *,
    status_filter: str | None = None,
    recalled: bool = False,
) -> list[dict[str, Any]]:
    """History (not recalled) newest first, or the employee's recalled requests."""
    employee_id = _employee_uuid(actor)
    stmt = (
        select(LeaveRequest, LeaveType.leave_type_name)
        .join(LeaveType, LeaveType.leave_type_id == LeaveRequest.leave_type_id)
        .where(LeaveRequest.employee_id == employee_id)
        .options(selectinload(LeaveRequest.days))
        .order_by(LeaveRequest.submitted_date.desc())
    )
    if recalled:
        stmt = stmt.where(LeaveRequest.recalled_at.is_not(None))
    else:
        stmt = stmt.where(
            LeaveRequest.recalled_at.is_(None),
            LeaveRequest.status.in_(HISTORY_STATUSES),
        )
        if status_filter:
            if status_filter not in HISTORY_STATUSES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="status must be Pending, Approved, or Rejected",
                )
            stmt = stmt.where(LeaveRequest.status == status_filter)
    rows = (await db.execute(stmt)).all()
    items = [request_to_dict(request, type_name) for request, type_name in rows]
    if any(item["status"] == LEAVE_STATUS_PENDING and not item["recalled"] for item in items):
        label = await waiting_on_label(db, await _load_employee(db, actor))
        for item in items:
            if item["status"] == LEAVE_STATUS_PENDING and not item["recalled"]:
                item["waitingOn"] = label
    return items


async def _pending_days_by_type(
    db: AsyncSession, employee_id: uuid.UUID, year: int
) -> dict[uuid.UUID, Decimal]:
    """Days in submitted (not recalled) Pending requests, per leave type, for one year."""
    rows = (
        await db.execute(
            select(LeaveRequest.leave_type_id, func.sum(LeaveRequestDay.day_value))
            .join(LeaveRequest, LeaveRequest.leave_request_id == LeaveRequestDay.leave_request_id)
            .where(
                LeaveRequest.employee_id == employee_id,
                LeaveRequest.status == LEAVE_STATUS_PENDING,
                LeaveRequest.recalled_at.is_(None),
                LeaveRequestDay.leave_year == year,
            )
            .group_by(LeaveRequest.leave_type_id)
        )
    ).all()
    return {type_id: Decimal(str(total or 0)) for type_id, total in rows}


async def list_own_balances(db: AsyncSession, actor: dict[str, Any]) -> list[dict[str, Any]]:
    """Current-year balance per leave type, plus Unpaid (used days only)."""
    employee_id = _employee_uuid(actor)
    year = _today().year
    employee = await db.get(Employee, employee_id)
    if employee is not None:
        await _ensure_current_year_balances(db, employee)
    pending = await _pending_days_by_type(db, employee_id, year)
    rows = (
        await db.execute(
            select(LeaveBalance, LeaveType)
            .join(LeaveType, LeaveType.leave_type_id == LeaveBalance.leave_type_id)
            .where(LeaveBalance.employee_id == employee_id, LeaveBalance.leave_year == year)
            .order_by(LeaveType.leave_type_name)
        )
    ).all()
    balances: list[dict[str, Any]] = [
        {
            "leaveTypeId": str(leave_type.leave_type_id),
            "leaveTypeName": leave_type.leave_type_name,
            "description": leave_type.description,
            "leaveYear": year,
            "unlimited": False,
            "selectable": leave_type.status == MASTER_STATUS_ACTIVE,
            "entitledDays": _as_float(balance.entitled_days),
            "carriedForwardDays": _as_float(balance.carried_forward_days),
            "usedDays": _as_float(balance.used_days),
            "pendingDays": _as_float(pending.get(leave_type.leave_type_id, Decimal("0"))),
            "remainingDays": _as_float(balance.remaining_days),
        }
        for balance, leave_type in rows
    ]

    unpaid = (
        await db.execute(select(LeaveType).where(LeaveType.leave_type_name == UNPAID_LEAVE_TYPE_NAME))
    ).scalar_one_or_none()
    if unpaid is not None:
        used = (
            await db.execute(
                select(func.coalesce(func.sum(LeaveRequestDay.day_value), 0))
                .join(LeaveRequest, LeaveRequest.leave_request_id == LeaveRequestDay.leave_request_id)
                .where(
                    LeaveRequest.employee_id == employee_id,
                    LeaveRequest.leave_type_id == unpaid.leave_type_id,
                    LeaveRequest.status == LEAVE_STATUS_APPROVED,
                    LeaveRequestDay.leave_year == year,
                )
            )
        ).scalar_one()
        balances.append(
            {
                "leaveTypeId": str(unpaid.leave_type_id),
                "leaveTypeName": unpaid.leave_type_name,
                "description": unpaid.description,
                "leaveYear": year,
                "unlimited": True,
                "selectable": unpaid.status == MASTER_STATUS_ACTIVE,
                "entitledDays": None,
                "carriedForwardDays": None,
                "usedDays": _as_float(used),
                "pendingDays": _as_float(pending.get(unpaid.leave_type_id, Decimal("0"))),
                "remainingDays": None,
            }
        )
    return balances
