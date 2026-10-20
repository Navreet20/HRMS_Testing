from typing import Any

from fastapi import APIRouter, Depends, Query

from app.core.role_groups import ADMIN_ROLES, HR_STAFF_ROLES, TIMESHEET_ROLES
from app.dependencies import CurrentUser, require_roles
from app.modules.deps import DbSession
from app.modules.config import service as svc

router = APIRouter(prefix="/config", tags=["Config"])


@router.post("/seed", dependencies=[Depends(require_roles(*ADMIN_ROLES))])
async def save_config(db: DbSession) -> list[dict]:
    return await svc.save_config(db)


@router.patch("", dependencies=[Depends(require_roles(*ADMIN_ROLES))])
async def update_config(db: DbSession, body: list[dict[str, Any]]) -> list[dict]:
    return await svc.update_config(db, body)


@router.get("", dependencies=[Depends(require_roles(*TIMESHEET_ROLES))])
async def get_config(db: DbSession) -> list[dict]:
    return await svc.get_config(db)


@router.delete("", dependencies=[Depends(require_roles(*ADMIN_ROLES))])
async def delete_config(db: DbSession) -> dict:
    return await svc.delete_config(db)


@router.get("/by-department")
async def get_config_by_department(db: DbSession, user: CurrentUser) -> list[dict]:
    return await svc.get_config_by_department(db, user)


@router.get("/emails", dependencies=[Depends(require_roles(*TIMESHEET_ROLES))])
async def get_config_emails(db: DbSession, user: CurrentUser, type: str = Query(...)) -> list[dict]:
    return await svc.get_config_emails(db, type)


@router.post("/job-family/seed", dependencies=[Depends(require_roles(*ADMIN_ROLES))])
async def save_job_family(db: DbSession) -> list[dict]:
    return await svc.save_job_family(db)


@router.get("/job-family", dependencies=[Depends(require_roles(*HR_STAFF_ROLES))])
async def get_job_family(db: DbSession) -> list[dict]:
    return await svc.get_job_family(db)


@router.post("/job-family", dependencies=[Depends(require_roles(*ADMIN_ROLES))])
async def update_job_family(db: DbSession, body: list[dict[str, Any]]) -> list[dict]:
    return await svc.update_job_family(db, body)


@router.post("/emails", dependencies=[Depends(require_roles(*ADMIN_ROLES))])
async def save_config_emails(db: DbSession, user: CurrentUser, body: dict[str, Any]) -> dict:
    return await svc.save_config_emails(db, body)


@router.post("/hierarchy", dependencies=[Depends(require_roles(*ADMIN_ROLES))])
async def save_config_hierarchy(db: DbSession, user: CurrentUser, body: list[dict[str, Any]]) -> list[dict]:
    return await svc.save_config_hierarchy(db, body)


@router.get("/hierarchy", dependencies=[Depends(require_roles(*HR_STAFF_ROLES))])
async def get_config_hierarchy(db: DbSession) -> list[dict]:
    return await svc.get_config_hierarchy(db)
