import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.core.role_groups import FINANCE_ROLES
from app.dependencies import CurrentUser, require_roles
from app.modules.deps import DbSession
from app.modules.expenses import service as svc

router = APIRouter(prefix="/expenses", tags=["Expenses"])


@router.get("", dependencies=[Depends(require_roles(*FINANCE_ROLES))])
async def list_expenses(db: DbSession) -> list[dict]:
    return await svc.list_expenses(db)


@router.get("/by-employee", dependencies=[Depends(require_roles(*FINANCE_ROLES))])
async def expenses_by_employee(db: DbSession, employee_id: str = Query(...)) -> list[dict]:
    return await svc.expenses_by_employee(db, employee_id)


@router.get("/summary", dependencies=[Depends(require_roles(*FINANCE_ROLES))])
async def payroll_and_expenses(db: DbSession) -> dict:
    return await svc.payroll_and_expenses_summary(db)


@router.post("", dependencies=[Depends(require_roles(*FINANCE_ROLES))])
async def create_expenses(db: DbSession, user: CurrentUser, body: list[dict[str, Any]]) -> list[dict]:
    return await svc.create_expenses(db, user, body)


@router.patch("/{expense_id}", dependencies=[Depends(require_roles(*FINANCE_ROLES))])
async def update_expense(db: DbSession, user: CurrentUser, expense_id: uuid.UUID, body: dict[str, Any]) -> dict:
    return await svc.update_expense(db, expense_id, body)
