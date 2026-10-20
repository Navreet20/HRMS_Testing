"""Leave balance helpers — LEAVE-DATA-6 calculation + approve/reject paths.

Rules: calendar year; Personal mid-year proration; other types full grant;
Unpaid has no balance row; rollover capped at prior-year max_rollover_days;
used_days only on Approve; restore on reject-after-approve (current year).
"""

from __future__ import annotations

import math
import uuid
from datetime import date
from decimal import Decimal
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.tables import (
    Employee,
    LeaveBalance,
    LeavePolicy,
    LeavePolicyLine,
    LeaveRequest,
    LeaveRequestDay,
    LeaveType,
)
from app.modules.leave.constants import (
    PERSONAL_LEAVE_TYPE_NAME,
    UNPAID_LEAVE_TYPE_NAME,
)


def _d(value: float | Decimal | int | None) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


def _as_float(value: Decimal) -> float:
    return float(value.quantize(Decimal("0.1")))


def compute_remaining(
    entitled: float | Decimal,
    carried_forward: float | Decimal,
    used: float | Decimal,
) -> Decimal:
    remaining = _d(entitled) + _d(carried_forward) - _d(used)
    return remaining if remaining > 0 else Decimal("0")


def prorate_personal_days(days_allowed: float | Decimal, join_date: date, leave_year: int) -> Decimal:
    """Personal mid-year proration: (days/12)*months_remaining, floor to whole day.

    Join month counts if day <= 20; otherwise counting starts the next month.
    Existing employees (joined before leave_year) receive full days_allowed.
    """
    allowed = _d(days_allowed)
    if join_date.year < leave_year:
        return allowed
    if join_date.year > leave_year:
        return Decimal("0")

    start_month = join_date.month
    if join_date.day > 20:
        start_month += 1
    if start_month > 12:
        return Decimal("0")
    months_remaining = 12 - start_month + 1
    raw = (allowed / Decimal(12)) * Decimal(months_remaining)
    return Decimal(math.floor(raw))


def compute_rollover_days(
    prior_remaining: float | Decimal,
    *,
    rollover_allowed: bool,
    max_rollover_days: float | Decimal | None,
) -> Decimal:
    """Unused prior-year remaining capped at that year's max_rollover_days.

    Returns 0 when rollover is off, max is missing/non-positive, or nothing remains.
    """
    if not rollover_allowed or max_rollover_days is None:
        return Decimal("0")
    remaining = _d(prior_remaining)
    if remaining <= 0:
        return Decimal("0")
    cap = _d(max_rollover_days)
    if cap <= 0:
        return Decimal("0")
    return remaining if remaining <= cap else cap


async def _prior_year_rollover(
    db: AsyncSession,
    *,
    employee_id: uuid.UUID,
    leave_type_id: uuid.UUID,
    leave_year: int,
    line: LeavePolicyLine,
) -> Decimal:
    """Load prior-year remaining and apply the policy line's rollover cap."""
    prior_year = leave_year - 1
    result = await db.execute(
        select(LeaveBalance).where(
            LeaveBalance.employee_id == employee_id,
            LeaveBalance.leave_type_id == leave_type_id,
            LeaveBalance.leave_year == prior_year,
        )
    )
    prior = result.scalar_one_or_none()
    if prior is None:
        return Decimal("0")
    return compute_rollover_days(
        prior.remaining_days,
        rollover_allowed=bool(line.rollover_allowed),
        max_rollover_days=line.max_rollover_days,
    )


async def get_remaining(
    db: AsyncSession,
    employee_id: uuid.UUID,
    leave_type_id: uuid.UUID,
    leave_year: int | None = None,
) -> Decimal:
    """Return remaining days for an employee/type/year. Unpaid → unbounded (None as -1 sentinel via large value).

    Raises 404 if a balance row is required but missing.
    """
    year = leave_year or date.today().year
    leave_type = await db.get(LeaveType, leave_type_id)
    if leave_type is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave type not found")
    if leave_type.leave_type_name == UNPAID_LEAVE_TYPE_NAME:
        return Decimal("-1")  # unlimited sentinel for callers

    result = await db.execute(
        select(LeaveBalance).where(
            LeaveBalance.employee_id == employee_id,
            LeaveBalance.leave_type_id == leave_type_id,
            LeaveBalance.leave_year == year,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave balance not found for employee/type/year",
        )
    return _d(row.remaining_days)


async def ensure_year_balances(
    db: AsyncSession,
    employee_id: uuid.UUID,
    leave_year: int | None = None,
    *,
    join_date: date | None = None,
) -> list[LeaveBalance]:
    """Create current-year LeaveBalance rows from the employee's assigned policy.

    Personal is prorated for mid-year joiners; other types get full days_allowed.
    Carried-forward comes from prior-year remaining capped by the policy line.
    Skips Unpaid. Idempotent: existing rows are left unchanged.
    """
    year = leave_year or date.today().year
    employee = await db.get(Employee, employee_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    if employee.leave_policy_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee has no leave policy assigned",
        )

    policy_result = await db.execute(
        select(LeavePolicy)
        .where(LeavePolicy.policy_id == employee.leave_policy_id)
        .options(selectinload(LeavePolicy.lines))
    )
    policy = policy_result.scalar_one_or_none()
    if policy is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave policy not found")

    emp_join = join_date
    if emp_join is None and employee.employment_start_date:
        try:
            emp_join = date.fromisoformat(str(employee.employment_start_date)[:10])
        except ValueError:
            emp_join = date(year, 1, 1)
    if emp_join is None:
        emp_join = date(year, 1, 1)

    created: list[LeaveBalance] = []
    for line in policy.lines:
        leave_type = await db.get(LeaveType, line.leave_type_id)
        if leave_type is None:
            continue
        if leave_type.leave_type_name == UNPAID_LEAVE_TYPE_NAME:
            continue

        existing = await db.execute(
            select(LeaveBalance).where(
                LeaveBalance.employee_id == employee_id,
                LeaveBalance.leave_type_id == line.leave_type_id,
                LeaveBalance.leave_year == year,
            )
        )
        if existing.scalar_one_or_none() is not None:
            continue

        if leave_type.leave_type_name == PERSONAL_LEAVE_TYPE_NAME:
            entitled = prorate_personal_days(line.days_allowed, emp_join, year)
        else:
            entitled = _d(line.days_allowed)

        carried = await _prior_year_rollover(
            db,
            employee_id=employee_id,
            leave_type_id=line.leave_type_id,
            leave_year=year,
            line=line,
        )
        # New schema stores entitled + carried only; used/remaining are view-derived.
        _ = compute_remaining(entitled, carried, Decimal("0"))
        balance = LeaveBalance(
            employee_id=employee_id,
            leave_type_id=line.leave_type_id,
            leave_year=year,
            entitled_days=entitled,
            carried_forward_days=carried,
        )
        db.add(balance)
        created.append(balance)

    if created:
        await db.flush()
    return created


async def run_annual_leave_grant(
    db: AsyncSession,
    leave_year: int | None = None,
) -> dict[str, Any]:
    """Jan 1 grant + rollover for every employee with an assigned leave policy.

    Creates missing balances for ``leave_year`` (default: current calendar year).
    Existing employees receive full Personal entitlement; prior-year unused days
    roll forward per each policy line's rollover rules. Idempotent per year.
    """
    year = leave_year if leave_year is not None else date.today().year
    result = await db.execute(
        select(Employee).where(Employee.leave_policy_id.is_not(None))
    )
    employees = list(result.scalars().all())

    employees_touched = 0
    balances_created = 0
    errors: list[dict[str, str]] = []

    for employee in employees:
        try:
            created = await ensure_year_balances(db, employee.employee_id, year)
        except HTTPException as exc:
            errors.append(
                {
                    "employeeId": str(employee.employee_id),
                    "detail": str(exc.detail),
                }
            )
            continue
        if created:
            employees_touched += 1
            balances_created += len(created)

    return {
        "leaveYear": year,
        "employeesScanned": len(employees),
        "employeesGranted": employees_touched,
        "balancesCreated": balances_created,
        "errors": errors,
    }


async def _load_request_with_days(
    db: AsyncSession, leave_request_id: uuid.UUID
) -> LeaveRequest:
    result = await db.execute(
        select(LeaveRequest)
        .where(LeaveRequest.leave_request_id == leave_request_id)
        .options(selectinload(LeaveRequest.days))
    )
    request = result.scalar_one_or_none()
    if request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found")
    return request


def _day_value(day: LeaveRequestDay) -> Decimal:
    part = getattr(day, "half_part", None) or "full"
    if part in ("first", "second"):
        return Decimal("0.5")
    if hasattr(day, "day_value") and day.day_value is not None:
        return _d(day.day_value)
    return Decimal("1")


def _leave_year(day: LeaveRequestDay) -> int:
    return int(getattr(day, "leave_year", None) or day.leave_date.year)


async def _adjust_used_for_days(
    db: AsyncSession,
    request: LeaveRequest,
    days: list[LeaveRequestDay],
    *,
    restore: bool,
) -> None:
    """No-op mutate: new schema stores entitled+carried only.

    Used/remaining come from approved ``leave_request_days`` (view). On approve we
    still verify a balance row exists and remaining covers the request.
    """
    leave_type = await db.get(LeaveType, request.leave_type_id)
    type_name = getattr(leave_type, "leave_type_name", None) or getattr(leave_type, "name", None)
    if leave_type is not None and type_name == UNPAID_LEAVE_TYPE_NAME:
        return
    if restore:
        return

    by_year: dict[int, Decimal] = {}
    for day in days:
        year = _leave_year(day)
        by_year[year] = by_year.get(year, Decimal("0")) + _day_value(day)

    for year, amount in by_year.items():
        result = await db.execute(
            select(LeaveBalance).where(
                LeaveBalance.employee_id == request.employee_id,
                LeaveBalance.leave_type_id == request.leave_type_id,
                LeaveBalance.leave_year == year,
            )
        )
        balance = result.scalar_one_or_none()
        if balance is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Leave balance not found for year {year}",
            )
        entitled = _d(balance.entitled_days) + _d(balance.carried_forward_days)
        # Approximate used from already-approved days this year (excluding this request).
        used_q = await db.execute(
            select(LeaveRequestDay).join(
                LeaveRequest, LeaveRequest.id == LeaveRequestDay.leave_request_id
            ).where(
                LeaveRequest.employee_id == request.employee_id,
                LeaveRequest.leave_type_id == request.leave_type_id,
                LeaveRequest.status == "Approved",
                LeaveRequest.id != request.id,
            )
        )
        used = Decimal("0")
        for existing in used_q.scalars().all():
            if _leave_year(existing) == year:
                used += _day_value(existing)
        remaining = entitled - used
        if amount > remaining:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient leave balance for {year}",
            )


async def apply_approval_deduction(db: AsyncSession, leave_request_id: uuid.UUID) -> LeaveRequest:
    """Validate balance on Approve; used days are derived from approved day rows."""
    request = await _load_request_with_days(db, leave_request_id)
    await _adjust_used_for_days(db, request, list(request.days), restore=False)
    return request


async def restore_on_reject(
    db: AsyncSession,
    leave_request_id: uuid.UUID,
    *,
    current_year_only: bool = True,
) -> LeaveRequest:
    """Restore days after reject-after-approve (DATA-11).

    When ``current_year_only`` is True, only days whose leave_year equals the
    current calendar year are restored (closed prior years unchanged).
    """
    request = await _load_request_with_days(db, leave_request_id)
    this_year = date.today().year
    days_to_restore = [
        d
        for d in request.days
        if not current_year_only or d.leave_year == this_year
    ]
    if days_to_restore:
        await _adjust_used_for_days(db, request, days_to_restore, restore=True)
    return request


def balance_to_dict(row: LeaveBalance) -> dict[str, Any]:
    return {
        "balanceId": str(row.balance_id),
        "employeeId": str(row.employee_id),
        "leaveTypeId": str(row.leave_type_id),
        "leaveYear": row.leave_year,
        "entitledDays": float(row.entitled_days),
        "carriedForwardDays": float(row.carried_forward_days),
        "usedDays": float(row.used_days),
        "remainingDays": float(row.remaining_days),
    }


async def apply_policy_days_allowed_change(
    db: AsyncSession,
    *,
    policy_id: uuid.UUID,
    leave_type_id: uuid.UUID,
    old_days_allowed: float | Decimal,
    new_days_allowed: float | Decimal,
    leave_year: int | None = None,
) -> int:
    """Apply DATA-3 days_allowed delta to current-year balances for assigned employees.

    Increase: add delta to entitled_days and remaining_days.
    Decrease: reduce remaining (never < 0); never change used_days.
    Past years are left unchanged. Returns number of balance rows updated.
    """
    delta = _d(new_days_allowed) - _d(old_days_allowed)
    if delta == 0:
        return 0

    year = leave_year if leave_year is not None else date.today().year
    emp_result = await db.execute(
        select(Employee.employee_id).where(Employee.leave_policy_id == policy_id)
    )
    employee_ids = list(emp_result.scalars().all())
    if not employee_ids:
        return 0

    bal_result = await db.execute(
        select(LeaveBalance).where(
            LeaveBalance.employee_id.in_(employee_ids),
            LeaveBalance.leave_type_id == leave_type_id,
            LeaveBalance.leave_year == year,
        )
    )
    updated = 0
    for balance in bal_result.scalars().all():
        new_entitled = _d(balance.entitled_days) + delta
        if new_entitled < 0:
            new_entitled = Decimal("0")
        balance.entitled_days = _as_float(new_entitled)
        # used_days never changes; remaining recalculated and floored at 0
        balance.remaining_days = _as_float(
            compute_remaining(
                balance.entitled_days,
                balance.carried_forward_days,
                balance.used_days,
            )
        )
        updated += 1
    if updated:
        await db.flush()
    return updated
