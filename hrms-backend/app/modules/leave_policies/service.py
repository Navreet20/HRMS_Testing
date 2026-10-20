"""Leave policy CRUD against the 37-table schema (no company_id / audit columns)."""

from __future__ import annotations

import uuid
from decimal import Decimal, InvalidOperation
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.tables import Employee, LeavePolicy, LeavePolicyLine, LeaveType
from app.modules.leave.balance_service import apply_policy_days_allowed_change
from app.modules.leave.constants import (
    MASTER_STATUS_ACTIVE,
    MASTER_STATUS_INACTIVE,
    UNPAID_LEAVE_TYPE_NAME,
)
from app.modules.leave_policies.schemas import (
    LeavePolicyCreateBody,
    LeavePolicyDaysUpdateBody,
    LeavePolicyStatusBody,
    PolicyLineCreate,
)

POLICY_NAME_TAKEN = "A leave policy with this name already exists"
POLICY_YEAR_RANGE_INVALID = "End year must be the same as or later than start year"
POLICY_LINES_REQUIRED = "Add at least one leave type row"
POLICY_DUPLICATE_TYPE = "Each leave type can only appear once in a policy"
POLICY_UNPAID_BLOCKED = "Unpaid leave cannot be added to a policy"
POLICY_TYPE_INACTIVE = "Only Active leave types can be added to a policy"
POLICY_TYPE_NOT_FOUND = "Leave type not found"
POLICY_DAYS_INVALID = "Days allowed must be zero or greater in 0.5 increments"
POLICY_MAX_ROLLOVER_REQUIRED = "Max rollover days is required when rollover is allowed"
POLICY_MAX_ROLLOVER_INVALID = (
    "Max rollover days must be at least 0.5 and not greater than days allowed"
)
POLICY_NOT_FOUND = "Leave policy not found"
POLICY_STATUS_INVALID = "Status must be Active or Inactive"
POLICY_LINE_NOT_FOUND = "Leave policy line not found"
POLICY_LINES_UPDATE_REQUIRED = "Provide at least one leave entitlement to update"


def _as_decimal(value: Decimal | float | int | str) -> Decimal:
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=POLICY_DAYS_INVALID
        ) from exc


def _is_half_step(value: Decimal) -> bool:
    scaled = value * 2
    return scaled == scaled.to_integral_value()


def _validate_days_allowed(value: Decimal | float | int | str) -> Decimal:
    days = _as_decimal(value)
    if days < 0 or not _is_half_step(days):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=POLICY_DAYS_INVALID
        )
    return days


def _validate_rollover(line: PolicyLineCreate, days_allowed: Decimal) -> Decimal | None:
    if not line.rollover_allowed:
        return None
    if line.max_rollover_days is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=POLICY_MAX_ROLLOVER_REQUIRED
        )
    max_days = _as_decimal(line.max_rollover_days)
    if max_days < Decimal("0.5") or max_days > days_allowed or not _is_half_step(max_days):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=POLICY_MAX_ROLLOVER_INVALID
        )
    return max_days


def _policy_status(policy: LeavePolicy) -> str:
    return MASTER_STATUS_ACTIVE if bool(getattr(policy, "is_active", True)) else MASTER_STATUS_INACTIVE


def _display_id(policy: LeavePolicy) -> str:
    return f"LVP-{str(policy.id).split('-')[0].upper()}"


def policy_line_to_dict(line: LeavePolicyLine, leave_type: LeaveType | None = None) -> dict[str, Any]:
    name = None
    description = None
    if leave_type is not None:
        name = getattr(leave_type, "leave_type_name", None) or getattr(leave_type, "name", None)
        description = getattr(leave_type, "description", None)
    return {
        "policyLineId": str(line.id),
        "leaveTypeId": str(line.leave_type_id),
        "leaveTypeName": name,
        "description": description,
        "daysAllowed": float(line.days_allowed) if line.days_allowed is not None else 0.0,
        "rolloverAllowed": bool(line.rollover_allowed),
        "maxRolloverDays": (
            float(line.max_rollover_days) if line.max_rollover_days is not None else None
        ),
    }


def policy_to_dict(
    policy: LeavePolicy,
    *,
    assigned_employee_count: int = 0,
    leave_types: dict[uuid.UUID, LeaveType] | None = None,
    company_id: uuid.UUID | None = None,
) -> dict[str, Any]:
    type_map = leave_types or {}
    lines = [
        policy_line_to_dict(line, type_map.get(line.leave_type_id))
        for line in sorted(
            policy.lines,
            key=lambda row: (
                (
                    getattr(type_map.get(row.leave_type_id), "name", "")
                    if type_map.get(row.leave_type_id)
                    else ""
                ),
                str(row.id),
            ),
        )
    ]
    return {
        "policyId": str(policy.id),
        "policyDisplayId": _display_id(policy),
        "companyId": str(company_id) if company_id else None,
        "policyName": policy.name,
        "policyStartYear": policy.start_year,
        "policyEndYear": policy.end_year,
        "status": _policy_status(policy),
        "assignedEmployeeCount": assigned_employee_count,
        "lines": lines,
    }


async def _assigned_counts(
    db: AsyncSession, policy_ids: list[uuid.UUID]
) -> dict[uuid.UUID, int]:
    if not policy_ids:
        return {}
    result = await db.execute(
        select(Employee.leave_policy_id, func.count())
        .where(Employee.leave_policy_id.in_(policy_ids))
        .group_by(Employee.leave_policy_id)
    )
    return {row[0]: int(row[1]) for row in result.all()}


async def _leave_type_map(
    db: AsyncSession, type_ids: set[uuid.UUID]
) -> dict[uuid.UUID, LeaveType]:
    if not type_ids:
        return {}
    result = await db.execute(select(LeaveType).where(LeaveType.id.in_(type_ids)))
    return {row.id: row for row in result.scalars().all()}


async def _assert_unique_name(
    db: AsyncSession,
    name: str,
    *,
    start_year: int,
    end_year: int,
    exclude_id: uuid.UUID | None = None,
) -> None:
    stmt = select(LeavePolicy.id).where(
        func.lower(LeavePolicy.name) == name.lower(),
        LeavePolicy.start_year == start_year,
        LeavePolicy.end_year == end_year,
    )
    if exclude_id is not None:
        stmt = stmt.where(LeavePolicy.id != exclude_id)
    if (await db.execute(stmt)).scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=POLICY_NAME_TAKEN)


async def _load_policy(db: AsyncSession, policy_id: uuid.UUID) -> LeavePolicy:
    result = await db.execute(
        select(LeavePolicy)
        .where(LeavePolicy.id == policy_id)
        .options(selectinload(LeavePolicy.lines))
    )
    policy = result.scalar_one_or_none()
    if policy is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=POLICY_NOT_FOUND)
    return policy


async def list_policies(
    db: AsyncSession,
    actor: dict[str, Any],
    *,
    include_inactive: bool = True,
) -> list[dict[str, Any]]:
    _ = actor
    stmt = (
        select(LeavePolicy)
        .options(selectinload(LeavePolicy.lines))
        .order_by(LeavePolicy.name)
    )
    if not include_inactive:
        stmt = stmt.where(LeavePolicy.is_active.is_(True))
    result = await db.execute(stmt)
    policies = list(result.scalars().unique().all())
    counts = await _assigned_counts(db, [p.id for p in policies])
    type_ids = {line.leave_type_id for p in policies for line in p.lines}
    types = await _leave_type_map(db, type_ids)
    return [
        policy_to_dict(
            policy,
            assigned_employee_count=counts.get(policy.id, 0),
            leave_types=types,
        )
        for policy in policies
    ]


async def get_policy(
    db: AsyncSession,
    actor: dict[str, Any],
    policy_id: uuid.UUID,
) -> dict[str, Any]:
    _ = actor
    policy = await _load_policy(db, policy_id)
    counts = await _assigned_counts(db, [policy.id])
    types = await _leave_type_map(db, {line.leave_type_id for line in policy.lines})
    return policy_to_dict(
        policy,
        assigned_employee_count=counts.get(policy.id, 0),
        leave_types=types,
    )


async def list_policy_options(
    db: AsyncSession,
    actor: dict[str, Any],
    *,
    include_policy_id: uuid.UUID | None = None,
) -> list[dict[str, Any]]:
    """Active policies for employee assign/change dropdowns."""
    _ = actor
    stmt = select(LeavePolicy).order_by(LeavePolicy.name)
    if include_policy_id is None:
        stmt = stmt.where(LeavePolicy.is_active.is_(True))
    else:
        stmt = stmt.where(
            LeavePolicy.is_active.is_(True) | (LeavePolicy.id == include_policy_id)
        )
    result = await db.execute(stmt)
    return [
        {
            "policyId": str(policy.id),
            "policyName": policy.name,
            "status": _policy_status(policy),
            "policyStartYear": policy.start_year,
            "policyEndYear": policy.end_year,
        }
        for policy in result.scalars().all()
    ]


async def create_policy(
    db: AsyncSession,
    actor: dict[str, Any],
    body: LeavePolicyCreateBody,
) -> dict[str, Any]:
    _ = actor
    if body.policy_end_year < body.policy_start_year:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=POLICY_YEAR_RANGE_INVALID
        )
    if not body.lines:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=POLICY_LINES_REQUIRED
        )

    await _assert_unique_name(
        db,
        body.policy_name,
        start_year=body.policy_start_year,
        end_year=body.policy_end_year,
    )

    seen_types: set[uuid.UUID] = set()
    resolved_lines: list[tuple[LeaveType, Decimal, bool, Decimal | None]] = []
    for line in body.lines:
        try:
            leave_type_id = uuid.UUID(str(line.leave_type_id).strip())
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=POLICY_TYPE_NOT_FOUND
            ) from exc
        if leave_type_id in seen_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=POLICY_DUPLICATE_TYPE
            )
        seen_types.add(leave_type_id)

        leave_type = await db.get(LeaveType, leave_type_id)
        if leave_type is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=POLICY_TYPE_NOT_FOUND
            )
        type_name = getattr(leave_type, "leave_type_name", None) or leave_type.name
        if type_name == UNPAID_LEAVE_TYPE_NAME:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=POLICY_UNPAID_BLOCKED
            )

        days_allowed = _validate_days_allowed(line.days_allowed)
        max_rollover = _validate_rollover(line, days_allowed)
        resolved_lines.append(
            (leave_type, days_allowed, bool(line.rollover_allowed), max_rollover)
        )

    policy = LeavePolicy(
        name=body.policy_name,
        start_year=body.policy_start_year,
        end_year=body.policy_end_year,
        is_active=True,
    )
    db.add(policy)
    await db.flush()

    for leave_type, days_allowed, rollover_allowed, max_rollover in resolved_lines:
        db.add(
            LeavePolicyLine(
                leave_policy_id=policy.id,
                leave_type_id=leave_type.id,
                days_allowed=days_allowed,
                rollover_allowed=rollover_allowed,
                max_rollover_days=max_rollover,
            )
        )
    try:
        await db.flush()
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=POLICY_NAME_TAKEN
        ) from exc

    policy = await _load_policy(db, policy.id)
    types = {lt.id: lt for lt, *_ in resolved_lines}
    return policy_to_dict(policy, assigned_employee_count=0, leave_types=types)


async def update_policy_days(
    db: AsyncSession,
    actor: dict[str, Any],
    policy_id: uuid.UUID,
    body: LeavePolicyDaysUpdateBody,
) -> dict[str, Any]:
    _ = actor
    if not body.lines:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=POLICY_LINES_UPDATE_REQUIRED
        )

    policy = await _load_policy(db, policy_id)
    lines_by_id = {line.id: line for line in policy.lines}

    for item in body.lines:
        try:
            line_id = uuid.UUID(str(item.policy_line_id).strip())
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=POLICY_LINE_NOT_FOUND
            ) from exc
        line = lines_by_id.get(line_id)
        if line is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=POLICY_LINE_NOT_FOUND
            )
        new_days = _validate_days_allowed(item.days_allowed)
        old_days = _as_decimal(line.days_allowed or 0)
        if new_days == old_days:
            continue
        if (
            line.rollover_allowed
            and line.max_rollover_days is not None
            and _as_decimal(line.max_rollover_days) > new_days
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=POLICY_MAX_ROLLOVER_INVALID,
            )
        await apply_policy_days_allowed_change(
            db,
            policy_id=policy.id,
            leave_type_id=line.leave_type_id,
            old_days_allowed=old_days,
            new_days_allowed=new_days,
        )
        line.days_allowed = new_days

    await db.flush()

    counts = await _assigned_counts(db, [policy.id])
    types = await _leave_type_map(db, {line.leave_type_id for line in policy.lines})
    return policy_to_dict(
        policy,
        assigned_employee_count=counts.get(policy.id, 0),
        leave_types=types,
    )


async def update_policy_status(
    db: AsyncSession,
    actor: dict[str, Any],
    policy_id: uuid.UUID,
    body: LeavePolicyStatusBody,
) -> dict[str, Any]:
    _ = actor
    normalized = body.status.strip()
    if normalized not in (MASTER_STATUS_ACTIVE, MASTER_STATUS_INACTIVE):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=POLICY_STATUS_INVALID
        )

    policy = await _load_policy(db, policy_id)
    policy.is_active = normalized == MASTER_STATUS_ACTIVE
    await db.flush()

    counts = await _assigned_counts(db, [policy.id])
    types = await _leave_type_map(db, {line.leave_type_id for line in policy.lines})
    return policy_to_dict(
        policy,
        assigned_employee_count=counts.get(policy.id, 0),
        leave_types=types,
    )
