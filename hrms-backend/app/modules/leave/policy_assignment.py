"""LEAVE-DATA-5 — assign or change an employee's leave policy.

On first assign: create current-year balances via ``ensure_year_balances`` (DATA-6 rules).
On change: remaining = new days_allowed − used YTD (floor 0); used_days unchanged.
"""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.tables import Employee, LeaveBalance, LeavePolicy, LeaveType
from app.modules.leave.balance_service import (
    _as_float,
    _d,
    ensure_year_balances,
)
from app.modules.leave.constants import (
    MASTER_STATUS_ACTIVE,
    UNPAID_LEAVE_TYPE_NAME,
)
from app.modules.org.service import resolve_org_master_company_id

LEAVE_POLICY_REQUIRED = "Leave policy is required"
LEAVE_POLICY_NOT_FOUND = "Leave policy not found"
LEAVE_POLICY_INACTIVE = "Only Active leave policies can be assigned"
LEAVE_POLICY_INVALID = "Invalid leavePolicyId"


def _parse_policy_id(raw: Any) -> uuid.UUID | None:
    if raw is None:
        return None
    text = str(raw).strip()
    if not text:
        return None
    try:
        return uuid.UUID(text)
    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=LEAVE_POLICY_INVALID,
        ) from exc


def _parse_join_date(employee: Employee, fallback: date | None = None) -> date:
    raw = getattr(employee, "employment_start_date", None)
    if raw:
        try:
            return date.fromisoformat(str(raw)[:10])
        except ValueError:
            pass
    return fallback or date.today()


async def _load_assignable_policy(
    db: AsyncSession,
    *,
    company_id: uuid.UUID | None = None,  # noqa: ARG001 — unused; new schema has no company_id on policies
    policy_id: uuid.UUID,
    current_policy_id: uuid.UUID | None,
) -> LeavePolicy:
    result = await db.execute(
        select(LeavePolicy)
        .where(LeavePolicy.id == policy_id)
        .options(selectinload(LeavePolicy.lines))
    )
    policy = result.scalar_one_or_none()
    if policy is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=LEAVE_POLICY_NOT_FOUND,
        )
    # Inactive policies stay on already-assigned employees; new assignment must be active.
    is_active = bool(getattr(policy, "is_active", True))
    if not is_active and policy.id != current_policy_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=LEAVE_POLICY_INACTIVE,
        )
    return policy


async def apply_policy_change_balances(
    db: AsyncSession,
    employee_id: uuid.UUID,
    policy: LeavePolicy,
    *,
    leave_year: int | None = None,
) -> list[LeaveBalance]:
    """Recalc current-year balances for a mid-year policy change (DATA-5).

    remaining = max(0, new days_allowed − used_days); used_days unchanged.
    """
    year = leave_year or date.today().year
    updated: list[LeaveBalance] = []

    for line in policy.lines:
        leave_type = await db.get(LeaveType, line.leave_type_id)
        if leave_type is None:
            continue
        type_name = getattr(leave_type, "leave_type_name", None) or getattr(leave_type, "name", None)
        if type_name == UNPAID_LEAVE_TYPE_NAME:
            continue

        days_allowed = _d(line.days_allowed)
        existing = await db.execute(
            select(LeaveBalance).where(
                LeaveBalance.employee_id == employee_id,
                LeaveBalance.leave_type_id == line.leave_type_id,
                LeaveBalance.leave_year == year,
            )
        )
        balance = existing.scalar_one_or_none()
        if balance is None:
            # New schema stores entitled + carried only (used/remaining come from a view).
            balance = LeaveBalance(
                employee_id=employee_id,
                leave_type_id=line.leave_type_id,
                leave_year=year,
                entitled_days=days_allowed,
                carried_forward_days=Decimal("0"),
            )
            db.add(balance)
        else:
            balance.entitled_days = days_allowed
        updated.append(balance)

    if updated:
        await db.flush()
    return updated


async def assign_or_change_leave_policy(
    db: AsyncSession,
    employee: Employee,
    policy_id_raw: Any,
    *,
    actor: dict[str, Any] | None = None,
    required: bool = True,
    effective_date: date | None = None,
) -> bool:
    """Assign or change ``employee.leave_policy_id`` and sync year balances.

    Returns True when a policy was applied (including no-op same-policy keep).
    When ``required`` is False and policy_id is absent, returns False without error.
    """
    policy_id = _parse_policy_id(policy_id_raw)
    if policy_id is None:
        if required:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=LEAVE_POLICY_REQUIRED,
            )
        return False

    company_id = await resolve_org_master_company_id(db, actor or {})
    previous_id = getattr(employee, "leave_policy_id", None)
    policy = await _load_assignable_policy(
        db,
        company_id=company_id,
        policy_id=policy_id,
        current_policy_id=previous_id,
    )

    is_change = previous_id is not None and previous_id != policy_id
    is_first_assign = previous_id is None

    employee.leave_policy_id = policy_id
    # New schema has no leave_policy_effective_date column.
    _ = effective_date

    await db.flush()

    if is_first_assign or (
        previous_id == policy_id
        and not await _has_year_balances(db, employee.employee_id)
    ):
        await ensure_year_balances(
            db,
            employee.employee_id,
            join_date=_parse_join_date(employee),
        )
    elif is_change:
        await apply_policy_change_balances(db, employee.employee_id, policy)

    return True


async def _has_year_balances(db: AsyncSession, employee_id: uuid.UUID) -> bool:
    year = date.today().year
    result = await db.execute(
        select(LeaveBalance.id)
        .where(
            LeaveBalance.employee_id == employee_id,
            LeaveBalance.leave_year == year,
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


def require_leave_policy_on_body(
    body: dict[str, Any],
    *,
    existing: Employee | None = None,
) -> Any:
    """Resolve leavePolicyId for create/invite; raise if missing.

    Prefer body value; fall back to already-stored assignment on invite-from-draft.
    """
    raw = body.get("leavePolicyId") if "leavePolicyId" in body else None
    if raw is None or not str(raw).strip():
        if existing is not None and existing.leave_policy_id is not None:
            return str(existing.leave_policy_id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=LEAVE_POLICY_REQUIRED,
        )
    return raw
