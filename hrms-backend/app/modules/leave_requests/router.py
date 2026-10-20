import uuid

from fastapi import APIRouter, Query, Response, status

from app.dependencies import CurrentUser
from app.modules.deps import DbSession
from app.modules.leave_requests import service as svc
from app.modules.leave_requests.schemas import LeavePreviewBody, LeaveRequestBody

router = APIRouter(prefix="/leave-requests", tags=["Leave Requests"])


@router.post("/preview")
async def preview_leave_request(db: DbSession, user: CurrentUser, body: LeavePreviewBody) -> dict:
    return await svc.preview_request(db, user, body)


@router.post("", status_code=status.HTTP_201_CREATED)
async def submit_leave_request(db: DbSession, user: CurrentUser, body: LeaveRequestBody) -> dict:
    return await svc.submit_request(db, user, body)


@router.get("/me")
async def list_my_leave_requests(
    db: DbSession,
    user: CurrentUser,
    status_filter: str | None = Query(None, alias="status"),
) -> list[dict]:
    return await svc.list_own_requests(db, user, status_filter=status_filter)


@router.get("/me/recalled")
async def list_my_recalled_leave_requests(db: DbSession, user: CurrentUser) -> list[dict]:
    return await svc.list_own_requests(db, user, recalled=True)


@router.get("/me/balances")
async def list_my_leave_balances(db: DbSession, user: CurrentUser) -> list[dict]:
    return await svc.list_own_balances(db, user)


@router.get("/{leave_request_id}")
async def get_my_leave_request(
    db: DbSession, user: CurrentUser, leave_request_id: uuid.UUID
) -> dict:
    return await svc.get_own_request(db, user, leave_request_id)


@router.post("/{leave_request_id}/recall")
async def recall_leave_request(
    db: DbSession, user: CurrentUser, leave_request_id: uuid.UUID
) -> dict:
    return await svc.recall_request(db, user, leave_request_id)


@router.post("/{leave_request_id}/reopen")
async def reopen_rejected_leave_request(
    db: DbSession, user: CurrentUser, leave_request_id: uuid.UUID
) -> dict:
    """A rejected request goes back to Recalled so it can be edited and resubmitted."""
    return await svc.reopen_rejected_request(db, user, leave_request_id)


@router.put("/{leave_request_id}")
async def resubmit_leave_request(
    db: DbSession, user: CurrentUser, leave_request_id: uuid.UUID, body: LeaveRequestBody
) -> dict:
    return await svc.resubmit_request(db, user, leave_request_id, body)


@router.delete("/{leave_request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recalled_leave_request(
    db: DbSession, user: CurrentUser, leave_request_id: uuid.UUID
) -> Response:
    await svc.delete_recalled_request(db, user, leave_request_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
