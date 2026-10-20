"""Parse and validate finance-table employee UUID pointers."""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.roles import Status
from app.models.tables import Employee


def parse_employee_uuid(value: object) -> uuid.UUID | None:
    """Return a UUID if `value` is one; otherwise None (codes/blank are rejected)."""
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    text = str(value).strip()
    if not text:
        return None
    try:
        return uuid.UUID(text)
    except (TypeError, ValueError):
        return None


def require_employee_uuid(value: object, *, field: str = "employeeId") -> uuid.UUID:
    parsed = parse_employee_uuid(value)
    if parsed is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field} must be a valid employee UUID",
        )
    return parsed


async def require_existing_employee(
    db: AsyncSession, value: object, *, field: str = "employeeId"
) -> uuid.UUID:
    """Parse a UUID and confirm it exists on EMPLOYEE.ID."""
    eid = require_employee_uuid(value, field=field)
    result = await db.execute(select(Employee.employee_id).where(Employee.employee_id == eid))
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field} does not match an existing employee",
        )
    return eid


async def require_active_employee(
    db: AsyncSession, value: object, *, field: str = "employeeId"
) -> uuid.UUID:
    """Parse a UUID and confirm it exists on EMPLOYEE.ID with ACTIVE status."""
    eid = require_employee_uuid(value, field=field)
    result = await db.execute(select(Employee).where(Employee.employee_id == eid))
    emp = result.scalar_one_or_none()
    if emp is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field} does not match an existing employee",
        )
    if (emp.status or "").strip().upper() != Status.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field} must be an active employee",
        )
    return eid
