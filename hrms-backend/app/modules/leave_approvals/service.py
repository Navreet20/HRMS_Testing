"""Manager / HR leave approvals (LEAVE-DATA-10, LEAVE-DATA-11).

Reporting managers act on their direct reports; HR, Admin, and Developer
(SUPERADMIN) may act on anyone, like the timesheet queue. Nobody acts on their
own request. Approval deducts each day from its own leave year; rejecting an
approved request restores days for the current and future years only (a
closed prior year is left as is).
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

from app.modules.workflow.events import (
    EVENT_APPROVED,
    EVENT_REJECTED,
    ITEM_LEAVE,
    record_event,
)
from app.models.tables import Employee, LeaveBalance, LeaveRequest, LeaveRequestDay, LeaveType
from app.modules.holidays.service import is_leave_admin
from app.modules.leave.balance_service import (
    _adjust_used_for_days,
    apply_approval_deduction,
    ensure_year_balances,
)
from app.modules.leave.constants import (
    LEAVE_STATUS_APPROVED,
    LEAVE_STATUS_PENDING,
    LEAVE_STATUS_REJECTED,
    UNPAID_LEAVE_TYPE_NAME,
)
from app.modules.leave_approvals.notify import (
    notify_employee_leave_approved,
    notify_employee_leave_rejected,
)
from app.modules.leave_requests.notify import employee_display_name
from app.modules.leave_requests.days import DayRow
from app.modules.leave_requests.service import _employee_uuid, _halves_clash, request_to_dict

QUEUE_STATUSES = (LEAVE_STATUS_PENDING, LEAVE_STATUS_APPROVED)
# Most people listed under "also off" for HR / Admin, who see the whole company.
TEAM_OFF_LIMIT = 100

RECALLED = "This request was recalled by the employee and can no longer be actioned"
NOT_PENDING = "Only a Pending request can be approved"
NOT_REJECTABLE = "Only a Pending or Approved request can be rejected"
OWN_REQUEST = "You cannot approve or reject your own leave request"
NOT_DIRECT_REPORT = "Employee is not a direct report of this manager"


def _today() -> date:
    return date.today()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_float(value: Any) -> float:
    return float(Decimal(str(value or 0)).quantize(Decimal("0.1")))


def _employee_label(employee: Employee) -> dict[str, Any]:
    return {
        "employeeId": str(employee.employee_id),
        "employeeName": employee_display_name(employee),
        "employeeCode": (
            getattr(employee, "business_employee_id", None)
            or getattr(employee, "employee_code", None)
            or ""
        ),
    }


def _type_name(leave_type: LeaveType) -> str:
    return getattr(leave_type, "leave_type_name", None) or leave_type.name


def _half_is_partial(half_part: str | None) -> bool:
    return half_part in ("first", "second")


async def _remaining_for(
    db: AsyncSession, request: LeaveRequest, leave_type: LeaveType
) -> float | None:
    """Remaining = entitled + carried − approved used (None = unlimited)."""
    if _type_name(leave_type) == UNPAID_LEAVE_TYPE_NAME:
        return None
    year = request.from_date.year
    balance = (
        await db.execute(
            select(LeaveBalance).where(
                LeaveBalance.employee_id == request.employee_id,
                LeaveBalance.leave_type_id == request.leave_type_id,
                LeaveBalance.leave_year == year,
            )
        )
    ).scalar_one_or_none()
    if balance is None:
        return 0.0
    entitled = Decimal(str(balance.entitled_days or 0)) + Decimal(
        str(balance.carried_forward_days or 0)
    )
    used_rows = (
        await db.execute(
            select(LeaveRequestDay)
            .join(LeaveRequest, LeaveRequest.id == LeaveRequestDay.leave_request_id)
            .where(
                LeaveRequest.employee_id == request.employee_id,
                LeaveRequest.leave_type_id == request.leave_type_id,
                LeaveRequest.status == LEAVE_STATUS_APPROVED,
            )
        )
    ).scalars().all()
    used = Decimal("0")
    for day in used_rows:
        if day.leave_date.year != year:
            continue
        used += Decimal("0.5") if _half_is_partial(day.half_part) else Decimal("1")
    return _as_float(entitled - used)


async def _has_overlap(db: AsyncSession, request: LeaveRequest) -> bool:
    """True when another live request takes one of the same days, or the same half of a day."""
    mine = {
        day.leave_date: DayRow(
            leave_date=day.leave_date,
            is_half_day=_half_is_partial(day.half_part),
            day_value=Decimal("0.5") if _half_is_partial(day.half_part) else Decimal("1"),
            half_part=day.half_part if _half_is_partial(day.half_part) else None,
        )
        for day in request.days
    }
    if not mine:
        return False
    others = (
        await db.execute(
            select(LeaveRequestDay)
            .join(LeaveRequest, LeaveRequest.id == LeaveRequestDay.leave_request_id)
            .where(
                LeaveRequest.employee_id == request.employee_id,
                LeaveRequest.id != request.id,
                LeaveRequest.status.in_(QUEUE_STATUSES),
                LeaveRequest.recalled_at.is_(None),
                LeaveRequestDay.leave_date.in_(list(mine)),
            )
        )
    ).scalars().all()
    return any(
        _halves_clash(
            mine[day.leave_date],
            _half_is_partial(day.half_part),
            day.half_part,
        )
        for day in others
    )


async def _queue_row(
    db: AsyncSession, request: LeaveRequest, employee: Employee, leave_type: LeaveType
) -> dict[str, Any]:
    name = _type_name(leave_type)
    row = request_to_dict(request, name)
    row.update(_employee_label(employee))
    row["remainingDays"] = await _remaining_for(db, request, leave_type)
    row["unlimited"] = name == UNPAID_LEAVE_TYPE_NAME
    row["overlaps"] = await _has_overlap(db, request)
    return row


async def count_waiting(db: AsyncSession, actor: dict[str, Any]) -> int:
    """How many Pending requests are waiting for this person (same scope as the queue)."""
    reviewer_id = _employee_uuid(actor)
    stmt = (
        select(func.count())
        .select_from(LeaveRequest)
        .join(Employee, Employee.employee_id == LeaveRequest.employee_id)
        .where(
            LeaveRequest.status == LEAVE_STATUS_PENDING,
            LeaveRequest.recalled_at.is_(None),
            LeaveRequest.employee_id != reviewer_id,
        )
    )
    if not is_leave_admin(actor):
        stmt = stmt.where(Employee.reporting_manager_id == reviewer_id)
    return int((await db.execute(stmt)).scalar_one())


async def approval_queue(
    db: AsyncSession, actor: dict[str, Any], status_filter: str = LEAVE_STATUS_PENDING
) -> list[dict[str, Any]]:
    if status_filter not in QUEUE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="status must be Pending or Approved",
        )
    reviewer_id = _employee_uuid(actor)
    filters = [
        LeaveRequest.status == status_filter,
        LeaveRequest.recalled_at.is_(None),
        LeaveRequest.employee_id != reviewer_id,
    ]
    if not is_leave_admin(actor):
        filters.append(Employee.reporting_manager_id == reviewer_id)
    order = (
        (LeaveRequest.submitted_date.asc(), LeaveRequest.leave_request_id.asc())
        if status_filter == LEAVE_STATUS_PENDING
        else (LeaveRequest.decided_at.desc().nulls_last(), LeaveRequest.leave_request_id.asc())
    )
    rows = (
        await db.execute(
            select(LeaveRequest, Employee, LeaveType)
            .join(Employee, Employee.employee_id == LeaveRequest.employee_id)
            .join(LeaveType, LeaveType.leave_type_id == LeaveRequest.leave_type_id)
            .where(*filters)
            .order_by(*order)
            .options(selectinload(LeaveRequest.days))
        )
    ).all()
    return [await _queue_row(db, request, employee, leave_type) for request, employee, leave_type in rows]


async def _load_for_review(
    db: AsyncSession, actor: dict[str, Any], leave_request_id: uuid.UUID
) -> tuple[LeaveRequest, Employee, LeaveType]:
    row = (
        await db.execute(
            select(LeaveRequest, Employee, LeaveType)
            .join(Employee, Employee.employee_id == LeaveRequest.employee_id)
            .join(LeaveType, LeaveType.leave_type_id == LeaveRequest.leave_type_id)
            .where(LeaveRequest.leave_request_id == leave_request_id)
            .options(selectinload(LeaveRequest.days))
        )
    ).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found")
    request, employee, leave_type = row
    reviewer_id = _employee_uuid(actor)
    if request.employee_id == reviewer_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=OWN_REQUEST)
    if not is_leave_admin(actor) and employee.reporting_manager_id != reviewer_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=NOT_DIRECT_REPORT)
    if request.recalled_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=RECALLED)
    return request, employee, leave_type


async def _ensure_balances_for_days(db: AsyncSession, request: LeaveRequest) -> None:
    """Make sure a balance row exists for every year the request touches."""
    years = sorted({day.leave_date.year for day in request.days})
    for year in years:
        exists = (
            await db.execute(
                select(LeaveBalance.id).where(
                    LeaveBalance.employee_id == request.employee_id,
                    LeaveBalance.leave_type_id == request.leave_type_id,
                    LeaveBalance.leave_year == year,
                )
            )
        ).scalar_one_or_none()
        if exists is None:
            await ensure_year_balances(db, request.employee_id, year)


async def team_off(
    db: AsyncSession, actor: dict[str, Any], leave_request_id: uuid.UUID
) -> list[dict[str, Any]]:
    """Who else is on leave on any of the same dates, so the reviewer sees the cover.

    A reporting manager sees only the requester's team (people with the same
    reporting manager); HR, Admin and Developer see everyone in the company.
    It never lists the requester.
    """
    request, employee, _ = await _load_for_review(db, actor, leave_request_id)
    company_wide = is_leave_admin(actor)
    if not company_wide and employee.reporting_manager_id is None:
        return []
    filters = [
        LeaveRequest.leave_request_id != request.leave_request_id,
        LeaveRequest.employee_id != request.employee_id,
        LeaveRequest.status.in_(QUEUE_STATUSES),
        LeaveRequest.recalled_at.is_(None),
        LeaveRequest.from_date <= request.to_date,
        LeaveRequest.to_date >= request.from_date,
    ]
    if not company_wide:
        filters.append(Employee.reporting_manager_id == employee.reporting_manager_id)
    rows = (
        await db.execute(
            select(LeaveRequest, Employee, LeaveType)
            .join(Employee, Employee.employee_id == LeaveRequest.employee_id)
            .join(LeaveType, LeaveType.leave_type_id == LeaveRequest.leave_type_id)
            .where(*filters)
            .order_by(LeaveRequest.from_date.asc(), Employee.first_name.asc())
            .limit(TEAM_OFF_LIMIT)
        )
    ).all()
    return [
        {
            **_employee_label(other),
            "leaveTypeName": leave_type.leave_type_name,
            "fromDate": other_request.from_date.isoformat(),
            "toDate": other_request.to_date.isoformat(),
            "status": other_request.status,
        }
        for other_request, other, leave_type in rows
    ]


async def approve_request(
    db: AsyncSession, actor: dict[str, Any], leave_request_id: uuid.UUID
) -> dict[str, Any]:
    request, employee, leave_type = await _load_for_review(db, actor, leave_request_id)
    if request.status != LEAVE_STATUS_PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=NOT_PENDING)
    if leave_type.leave_type_name != UNPAID_LEAVE_TYPE_NAME:
        await _ensure_balances_for_days(db, request)
    await apply_approval_deduction(db, request.leave_request_id)
    request.status = LEAVE_STATUS_APPROVED
    request.decided_at = _now()
    request.decided_by_employee_id = _employee_uuid(actor)
    leave_days = sum(
        (0.5 if getattr(d, "half_part", "full") in ("first", "second") else 1.0)
        for d in request.days
    )
    record_event(
        db,
        item_type=ITEM_LEAVE,
        item_id=request.leave_request_id,
        event=EVENT_APPROVED,
        user=actor,
    )
    await db.flush()
    await notify_employee_leave_approved(
        employee=employee,
        leave_type_name=getattr(leave_type, "leave_type_name", None) or leave_type.name,
        from_date=request.from_date,
        to_date=request.to_date,
        leave_days=float(leave_days),
    )
    return await _queue_row(db, request, employee, leave_type)


async def reject_request(
    db: AsyncSession, actor: dict[str, Any], leave_request_id: uuid.UUID, reason: str
) -> dict[str, Any]:
    request, employee, leave_type = await _load_for_review(db, actor, leave_request_id)
    if request.status not in QUEUE_STATUSES:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=NOT_REJECTABLE)
    after_approval = request.status == LEAVE_STATUS_APPROVED
    if after_approval:
        this_year = _today().year
        restorable = [
            day
            for day in request.days
            if (getattr(day, "leave_year", None) or day.leave_date.year) >= this_year
        ]
        if restorable:
            await _adjust_used_for_days(db, request, restorable, restore=True)
    request.status = LEAVE_STATUS_REJECTED
    request.rejection_reason = reason
    request.decided_at = _now()
    request.decided_by_employee_id = _employee_uuid(actor)
    record_event(
        db,
        item_type=ITEM_LEAVE,
        item_id=request.leave_request_id,
        event=EVENT_REJECTED,
        user=actor,
        comment=reason,
    )
    await db.flush()
    await notify_employee_leave_rejected(
        employee=employee,
        leave_type_name=getattr(leave_type, "leave_type_name", None) or leave_type.name,
        from_date=request.from_date,
        to_date=request.to_date,
        reason=reason,
        after_approval=after_approval,
    )
    return await _queue_row(db, request, employee, leave_type)
