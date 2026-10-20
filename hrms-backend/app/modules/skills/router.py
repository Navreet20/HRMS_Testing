import uuid

from typing import Any

from fastapi import APIRouter, Depends

from app.core.role_groups import ADMIN_ROLES, TIMESHEET_ROLES
from app.dependencies import CurrentUser, require_roles
from app.modules.deps import DbSession
from app.modules.skills import service as svc

router = APIRouter(tags=["Skills"])

_require_skill_admin = require_roles(
    *ADMIN_ROLES,
    detail="You do not have access to create or change skills. Ask an admin.",
)


@router.get("/skills", dependencies=[Depends(require_roles(*TIMESHEET_ROLES))])
async def list_skills(db: DbSession, user: CurrentUser) -> list[dict]:
    """Shared platform catalog for employee pickers (migration-managed)."""
    return await svc.list_skills(db, user)


@router.post("/skills/merge", dependencies=[Depends(_require_skill_admin)])
async def merge_skills(db: DbSession, user: CurrentUser, body: dict[str, Any]) -> dict:
    return await svc.merge_skills(db, user, body)


@router.get("/skills/{skill_id}", dependencies=[Depends(require_roles(*TIMESHEET_ROLES))])
async def get_skill(db: DbSession, user: CurrentUser, skill_id: uuid.UUID) -> dict:
    return await svc.get_skill(db, user, skill_id)


@router.post("/skills", dependencies=[Depends(_require_skill_admin)])
async def create_skill(db: DbSession, user: CurrentUser, body: dict[str, Any]) -> dict:
    """Disabled: catalog is migration-managed."""
    return await svc.create_skill(db, user, body)


@router.patch("/skills/{skill_id}", dependencies=[Depends(_require_skill_admin)])
async def update_skill(
    db: DbSession, user: CurrentUser, skill_id: uuid.UUID, body: dict[str, Any]
) -> dict:
    return await svc.update_skill(db, user, skill_id, body)
