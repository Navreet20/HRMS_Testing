from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import select

from app.models.tables import LeaveType
from app.modules.deps import DbSession

router = APIRouter(prefix="/leave-types", tags=["Leave Types"])


def leave_type_to_dict(row: LeaveType) -> dict:
    # leave_types is a fixed system list (id, name, is_unlimited); there is no description / status column.
    return {
        "leaveTypeId": str(row.id),
        "leaveTypeName": row.name,
        "description": None,
        "isUnlimited": bool(row.is_unlimited),
        "status": "Active",
    }


@router.get("")
async def list_active_leave_types(db: DbSession) -> list[dict]:
    """Leave types for policy/request/timesheet selectors."""
    result = await db.execute(select(LeaveType).order_by(LeaveType.name))
    return [leave_type_to_dict(r) for r in result.scalars().all()]
