"""Who an employee's pending item is waiting on (shown to the employee)."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.roles import Status
from app.models.tables import Employee

FALLBACK = "HR"


async def waiting_on_label(session: AsyncSession, employee: Employee | None) -> str:
    """The reporting manager's name, or HR when there is no active manager.

    HR and Admin can act on anyone's request, so a missing or inactive manager
    never leaves it stuck.
    """
    manager_id = getattr(employee, "reporting_manager_id", None)
    if manager_id is None:
        return FALLBACK
    manager = await session.get(Employee, manager_id)
    if manager is None or str(getattr(manager, "status", "")) != Status.ACTIVE.value:
        return FALLBACK
    name = f"{manager.first_name or ''} {manager.last_name or ''}".strip()
    return f"{name} (your manager)" if name else FALLBACK
