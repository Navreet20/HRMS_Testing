import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.core.role_groups import FINANCE_ROLES
from app.dependencies import CurrentUser, require_roles
from app.modules.deps import DbSession
from app.modules.expenses import service as svc

router = APIRouter(prefix="/payrolls", tags=["Payrolls"])


@router.get("", dependencies=[Depends(require_roles(*FINANCE_ROLES))])
async def list_payrolls(db: DbSession) -> list[dict]:
    return await svc.list_payrolls(db)


@router.get("/by-employee", dependencies=[Depends(require_roles(*FINANCE_ROLES))])
async def payroll_by_employee(db: DbSession, employee_id: str = Query(...)) -> list[dict]:
    return await svc.payroll_by_employee(db, employee_id)


@router.get("/w2-employees", dependencies=[Depends(require_roles(*FINANCE_ROLES))])
async def w2_employees(db: DbSession) -> list[dict]:
    return await svc.w2_employees(db)


@router.get("/blocked", dependencies=[Depends(require_roles(*FINANCE_ROLES))])
async def blocked_from_payroll(db: DbSession) -> list[dict]:
    """Employees who cannot be included in a payroll run (unverified bank, etc.)."""
    return await svc.blocked_from_payroll(db)


@router.post("", dependencies=[Depends(require_roles(*FINANCE_ROLES))])
async def create_payrolls(db: DbSession, user: CurrentUser, body: list[dict[str, Any]]) -> list[dict]:
    return await svc.create_payrolls(db, user, body)


@router.patch("/{payroll_id}", dependencies=[Depends(require_roles(*FINANCE_ROLES))])
async def update_payroll(db: DbSession, user: CurrentUser, payroll_id: uuid.UUID, body: dict[str, Any]) -> dict:
    return await svc.update_payroll(db, payroll_id, body)
