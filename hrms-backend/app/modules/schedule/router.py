import uuid
from typing import Any

from fastapi import APIRouter, Depends

from app.core.role_groups import HR_STAFF_ROLES, TIMESHEET_ROLES
from app.dependencies import CurrentUser, require_roles
from app.modules.deps import DbSession
from app.modules.schedule import service as svc

router = APIRouter(prefix="/schedule", tags=["Schedule"])


@router.get("", dependencies=[Depends(require_roles(*TIMESHEET_ROLES))])
async def list_schedule_events(db: DbSession) -> list[dict]:
    return await svc.list_events(db)


@router.get("/{event_id}", dependencies=[Depends(require_roles(*TIMESHEET_ROLES))])
async def get_schedule_event(db: DbSession, event_id: uuid.UUID) -> dict:
    return await svc.get_event(db, event_id)


@router.post("", dependencies=[Depends(require_roles(*HR_STAFF_ROLES))])
async def create_schedule_event(
    db: DbSession,
    user: CurrentUser,
    body: dict[str, Any],
) -> dict:
    return await svc.create_event(db, user, body)


@router.patch("/{event_id}", dependencies=[Depends(require_roles(*HR_STAFF_ROLES))])
async def update_schedule_event(
    db: DbSession,
    user: CurrentUser,
    event_id: uuid.UUID,
    body: dict[str, Any],
) -> dict:
    return await svc.update_event(db, user, event_id, body)


@router.delete("/{event_id}", dependencies=[Depends(require_roles(*HR_STAFF_ROLES))])
async def delete_schedule_event(db: DbSession, event_id: uuid.UUID) -> dict:
    return await svc.delete_event(db, event_id)
