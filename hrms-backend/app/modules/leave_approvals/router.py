import uuid

from fastapi import APIRouter, Query

from app.dependencies import CurrentUser
from app.modules.deps import DbSession
from app.modules.leave.constants import LEAVE_STATUS_PENDING
from app.modules.leave_approvals import service as svc
from app.modules.leave_approvals.schemas import LeaveRejectBody

router = APIRouter(prefix="/leave-approvals", tags=["Leave Approvals"])


@router.get("/queue")
async def leave_approval_queue(
    db: DbSession,
    user: CurrentUser,
    status_filter: str = Query(LEAVE_STATUS_PENDING, alias="status"),
) -> list[dict]:
    return await svc.approval_queue(db, user, status_filter)


@router.get("/{leave_request_id}/team-off")
async def leave_team_off(
    db: DbSession, user: CurrentUser, leave_request_id: uuid.UUID
) -> list[dict]:
    """Teammates on leave on the same days as this request."""
    return await svc.team_off(db, user, leave_request_id)


@router.post("/{leave_request_id}/approve")
async def approve_leave_request(
    db: DbSession, user: CurrentUser, leave_request_id: uuid.UUID
) -> dict:
    return await svc.approve_request(db, user, leave_request_id)


@router.post("/{leave_request_id}/reject")
async def reject_leave_request(
    db: DbSession, user: CurrentUser, leave_request_id: uuid.UUID, body: LeaveRejectBody
) -> dict:
    return await svc.reject_request(db, user, leave_request_id, body.reason)
