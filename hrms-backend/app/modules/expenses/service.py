from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.employee_ids import parse_employee_uuid, require_existing_employee
from app.core.roles import Status
from app.models.tables import (Employee)
from app.models.awaiting import (Expense, Payroll)
from app.core.serialize import employee_to_dict, expense_to_dict, payroll_to_dict


async def create_payrolls(db: AsyncSession, actor: dict, items: list[dict[str, Any]]) -> list[dict]:
    from app.modules.onboarding.payroll_gate import payroll_block_reason

    actor_name = f"{actor.get('firstName', '')} {actor.get('lastName', '')}".strip()
    blocked: list[dict[str, Any]] = []
    resolved: list[tuple[uuid.UUID, dict[str, Any]]] = []
    for item in items:
        emp_id = await require_existing_employee(db, item.get("employeeId"))
        reason = await payroll_block_reason(db, emp_id)
        if reason:
            blocked.append({"employeeId": str(emp_id), "reason": reason})
        resolved.append((emp_id, item))
    if blocked:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "One or more employees are blocked from payroll",
                "blocked": blocked,
            },
        )

    rows: list[Payroll] = []
    for emp_id, item in resolved:
        row = Payroll(
            employee_id=emp_id,
            payment_date=item.get("paymentDate"),
            amount=item.get("amount"),
            status=item.get("status") or Status.PENDING,
            created_by=actor_name,
            updated_by=actor_name,
            created_date=datetime.utcnow(),
            updated_date=datetime.utcnow(),
        )
        db.add(row)
        rows.append(row)
    await db.flush()
    return [payroll_to_dict(r) for r in rows]


async def list_payrolls(db: AsyncSession) -> list[dict]:
    result = await db.execute(select(Payroll))
    return [payroll_to_dict(r) for r in result.scalars().all()]


async def payroll_by_employee(db: AsyncSession, employee_id: str) -> list[dict]:
    eid = parse_employee_uuid(employee_id)
    if eid is None:
        return []
    result = await db.execute(select(Payroll).where(Payroll.employee_id == eid))
    return [payroll_to_dict(r) for r in result.scalars().all()]


async def update_payroll(db: AsyncSession, payroll_id: uuid.UUID, payload: dict[str, Any]) -> dict:
    result = await db.execute(select(Payroll).where(Payroll.payroll_id == payroll_id))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payroll not found")
    for key, attr in [("paymentDate", "payment_date"), ("amount", "amount"), ("status", "status")]:
        if payload.get(key) is not None:
            setattr(row, attr, payload[key])
    row.updated_date = datetime.utcnow()
    await db.flush()
    return payroll_to_dict(row)


async def w2_employees(db: AsyncSession) -> list[dict]:
    from app.modules.onboarding.payroll_gate import (
        block_reason_for_bank,
        primary_banks_by_employee,
    )

    result = await db.execute(select(Employee).where(Employee.employment_type == "W2"))
    employees = list(result.scalars().all())
    banks = await primary_banks_by_employee(db, [e.employee_id for e in employees])
    return [
        employee_to_dict(emp)
        for emp in employees
        if block_reason_for_bank(banks.get(emp.employee_id)) is None
    ]


async def blocked_from_payroll(db: AsyncSession) -> list[dict]:
    from app.modules.onboarding.payroll_gate import list_blocked_from_payroll

    return await list_blocked_from_payroll(db)


async def create_expenses(db: AsyncSession, actor: dict, items: list[dict[str, Any]]) -> list[dict]:
    actor_name = f"{actor.get('firstName', '')} {actor.get('lastName', '')}".strip()
    rows: list[Expense] = []
    for item in items:
        emp_id = await require_existing_employee(db, item.get("employeeId"))
        row = Expense(
            employee_id=emp_id,
            payment_date=item.get("paymentDate", ""),
            expense_type=item.get("expenseType", ""),
            expense_cost=item.get("expenseCost", 0),
            status=item.get("status") or Status.PENDING,
            created_by=actor_name,
            updated_by=actor_name,
            created_date=datetime.utcnow(),
            updated_date=datetime.utcnow(),
        )
        db.add(row)
        rows.append(row)
    await db.flush()
    return [expense_to_dict(r) for r in rows]


async def list_expenses(db: AsyncSession) -> list[dict]:
    result = await db.execute(select(Expense))
    return [expense_to_dict(r) for r in result.scalars().all()]


async def expenses_by_employee(db: AsyncSession, employee_id: str) -> list[dict]:
    eid = parse_employee_uuid(employee_id)
    if eid is None:
        return []
    result = await db.execute(select(Expense).where(Expense.employee_id == eid))
    return [expense_to_dict(r) for r in result.scalars().all()]


async def update_expense(db: AsyncSession, expense_id: uuid.UUID, payload: dict[str, Any]) -> dict:
    result = await db.execute(select(Expense).where(Expense.expenses_id == expense_id))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")
    for key, attr in [
        ("paymentDate", "payment_date"),
        ("expenseType", "expense_type"),
        ("expenseCost", "expense_cost"),
        ("status", "status"),
    ]:
        if payload.get(key) is not None:
            setattr(row, attr, payload[key])
    row.updated_date = datetime.utcnow()
    await db.flush()
    return expense_to_dict(row)


async def payroll_and_expenses_summary(db: AsyncSession) -> dict:
    payrolls = await list_payrolls(db)
    expenses = await list_expenses(db)
    return {"payrollCount": len(payrolls), "expenseCount": len(expenses), "payrolls": payrolls, "expenses": expenses}
