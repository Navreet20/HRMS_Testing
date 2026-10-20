"""Payroll eligibility helpers gated on verified primary bank account."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.awaiting import (EmployeeBankAccount)
from app.models.tables import Employee
from app.modules.employee.directory_clause import directory_employee_clause
from app.modules.onboarding.enums import BankAccountStatus


async def primary_bank_for_employee(
    session: AsyncSession, employee_id: uuid.UUID | str
) -> EmployeeBankAccount | None:
    try:
        eid = employee_id if isinstance(employee_id, uuid.UUID) else uuid.UUID(str(employee_id))
    except (TypeError, ValueError):
        return None
    result = await session.execute(
        select(EmployeeBankAccount)
        .where(
            EmployeeBankAccount.employee_id == eid,
            EmployeeBankAccount.is_primary.is_(True),
        )
        .order_by(EmployeeBankAccount.created_at.desc().nulls_last())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def primary_banks_by_employee(
    session: AsyncSession, employee_ids: list[uuid.UUID]
) -> dict[uuid.UUID, EmployeeBankAccount]:
    """Latest primary bank account per employee, for many employees in one query."""
    if not employee_ids:
        return {}
    result = await session.execute(
        select(EmployeeBankAccount)
        .where(
            EmployeeBankAccount.employee_id.in_(employee_ids),
            EmployeeBankAccount.is_primary.is_(True),
        )
        .order_by(EmployeeBankAccount.created_at.desc().nulls_last())
    )
    banks: dict[uuid.UUID, EmployeeBankAccount] = {}
    for bank in result.scalars().all():
        banks.setdefault(bank.employee_id, bank)  # newest first
    return banks


def block_reason_for_bank(bank: EmployeeBankAccount | None) -> str | None:
    if bank is None:
        return "No primary bank account on file"
    if bank.status != BankAccountStatus.VERIFIED:
        return f"Primary bank account is {bank.status}"
    return None


async def is_payroll_bank_ok(session: AsyncSession, employee_id: uuid.UUID | str) -> bool:
    bank = await primary_bank_for_employee(session, employee_id)
    return bank is not None and bank.status == BankAccountStatus.VERIFIED


async def payroll_block_reason(session: AsyncSession, employee_id: uuid.UUID | str) -> str | None:
    return block_reason_for_bank(await primary_bank_for_employee(session, employee_id))


async def list_blocked_from_payroll(session: AsyncSession) -> list[dict]:
    """Employees who are payroll-eligible or active but cannot be paid."""
    result = await session.execute(
        select(Employee).where(
            ((Employee.payroll_eligible.is_(True)) | (Employee.status == "ACTIVE"))
            & directory_employee_clause()
        )
    )
    blocked: list[dict] = []
    employees = list(result.scalars().all())
    banks = await primary_banks_by_employee(session, [e.employee_id for e in employees])
    for emp in employees:
        reason = block_reason_for_bank(banks.get(emp.employee_id))
        if reason is None:
            continue
        blocked.append(
            {
                "employeeId": str(emp.employee_id),
                "employeeCode": emp.employee_code,
                "firstName": emp.first_name,
                "lastName": emp.last_name,
                "emailId": emp.email_id,
                "status": emp.status,
                "payrollEligible": bool(emp.payroll_eligible),
                "reason": reason,
            }
        )
    return blocked
