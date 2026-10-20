"""Dashboard overview counts for the shell KPI gallery (read-only, new 37-table schema)."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.roles import Status
from app.models.tables import Client, Company, Employee, LeaveRequest, Project, Timesheet
from app.modules.employee.directory_clause import directory_employee_clause
from app.modules.leave.constants import LEAVE_STATUS_PENDING


def _count_metric(*, total: int, active: int) -> dict[str, int]:
    total_n = max(0, int(total))
    active_n = max(0, min(int(active), total_n))
    return {"total": total_n, "active": active_n}


async def _count(db: AsyncSession, model, *where) -> int:
    stmt = select(func.count()).select_from(model)
    if where:
        stmt = stmt.where(*where)
    return int(await db.scalar(stmt) or 0)


async def dashboard_data(db: AsyncSession) -> dict:
    """KPI counts used by the FE dashboard normalizer.

    Shape: { company, employee, customer, vendor, project: { total, active } } plus the legacy flat counts.
    Vendors and expenses are Awaiting Refinement (no tables): always 0.
    """
    employees_total = await _count(db, Employee, directory_employee_clause())
    employees_active = await _count(
        db, Employee, Employee.status == Status.ACTIVE, directory_employee_clause()
    )
    companies_total = await _count(db, Company)
    customers_total = await _count(db, Client)
    customers_active = await _count(db, Client, Client.status == "ACTIVE")
    projects_total = await _count(db, Project)
    projects_active = await _count(db, Project, Project.status == "ACTIVE")
    employee_metric = _count_metric(total=employees_total, active=employees_active)
    timesheets = await _count(db, Timesheet)
    pending_ts = await _count(db, Timesheet, Timesheet.status == "Submitted")
    leaves = await _count(db, LeaveRequest, LeaveRequest.status == LEAVE_STATUS_PENDING)
    return {
        # The single company row has no status column: every company is active.
        "company": _count_metric(total=companies_total, active=companies_total),
        "employee": employee_metric,
        "customer": _count_metric(total=customers_total, active=customers_active),
        "vendor": _count_metric(total=0, active=0),
        "project": _count_metric(total=projects_total, active=projects_active),
        # Legacy numeric field still consumed by normalizeDashboardData.
        "activeEmployees": employee_metric["active"],
        "timesheets": timesheets,
        "pendingTimesheets": pending_ts,
        "leaveApplications": leaves,
        "projects": projects_total,
        "expenses": 0,
    }
