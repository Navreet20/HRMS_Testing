import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.dependencies import CurrentUser
from app.modules.deps import DbSession
from app.modules.projects import service as svc
from app.modules.rbac.access import MODULE_KEY_PROJECTS, require_module_access
from app.modules.rbac.grants import ACCESS_LEVEL_FULL_ACCESS, ACCESS_LEVEL_READ_ONLY

router = APIRouter(prefix="/projects", tags=["Projects"])

_projects_read = require_module_access(
    MODULE_KEY_PROJECTS,
    min_level=ACCESS_LEVEL_READ_ONLY,
)
_projects_write = require_module_access(
    MODULE_KEY_PROJECTS,
    min_level=ACCESS_LEVEL_FULL_ACCESS,
)


@router.get("", dependencies=[Depends(_projects_read)])
async def list_projects(db: DbSession) -> list[dict]:
    return await svc.list_projects(db)


@router.get("/inactive", dependencies=[Depends(_projects_read)])
async def inactive_projects(db: DbSession) -> list[dict]:
    return await svc.inactive_projects(db)


@router.get("/search", dependencies=[Depends(_projects_read)])
async def search_projects(db: DbSession, q: str = Query(...)) -> list[dict]:
    return await svc.search_projects(db, q)


@router.get("/meta", dependencies=[Depends(_projects_read)])
async def project_meta() -> dict:
    """Master lists for project create/edit dropdowns (not hardcoded in the UI)."""
    return svc.project_meta()


@router.get("/allocations/active", dependencies=[Depends(_projects_read)])
async def active_allocations(
    db: DbSession,
    employee_ids: list[uuid.UUID] | None = Query(None, alias="employeeIds"),
) -> list[dict]:
    """Running allocations (employee, project, percentage, dates) for capacity checks."""
    return await svc.list_active_allocations(db, employee_ids)


@router.get("/{project_id}", dependencies=[Depends(_projects_read)])
async def get_project(db: DbSession, project_id: uuid.UUID) -> dict:
    return await svc.get_project(db, project_id)


@router.post("", dependencies=[Depends(_projects_write)])
async def create_project(db: DbSession, user: CurrentUser, body: dict[str, Any]) -> dict:
    return await svc.create_project(db, user, body)


@router.patch("/{project_id}", dependencies=[Depends(_projects_write)])
async def update_project(db: DbSession, user: CurrentUser, project_id: uuid.UUID, body: dict[str, Any]) -> dict:
    return await svc.update_project(db, user, project_id, body)


@router.delete("/{project_id}", dependencies=[Depends(_projects_write)])
async def delete_project(db: DbSession, user: CurrentUser, project_id: uuid.UUID) -> dict:
    """A project is never deleted: this closes it."""
    return await svc.delete_project(db, project_id, user)


@router.put("/{project_id}/members", dependencies=[Depends(_projects_write)])
async def set_project_members(
    db: DbSession, user: CurrentUser, project_id: uuid.UUID, body: dict[str, Any]
) -> dict:
    """Replace project managers and/or account owners: ``projectManagerIds``, ``accountOwnerIds``."""
    return await svc.set_project_members(db, user, project_id, body)


@router.put("/{project_id}/stakeholders", dependencies=[Depends(_projects_write)])
async def set_project_stakeholders(
    db: DbSession, user: CurrentUser, project_id: uuid.UUID, body: dict[str, Any]
) -> dict:
    """Replace the project's free-text client contacts: ``clientStakeholders: [{name, title, ...}]``."""
    return await svc.set_project_stakeholders(db, user, project_id, body)


@router.get(
    "/{project_id}/allocations",
    dependencies=[Depends(_projects_read)],
)
async def list_allocations(db: DbSession, project_id: uuid.UUID) -> list[dict]:
    return await svc.list_allocations(db, project_id)


@router.put(
    "/{project_id}/allocations",
    dependencies=[Depends(_projects_write)],
)
async def sync_allocations(
    db: DbSession,
    user: CurrentUser,
    project_id: uuid.UUID,
    body: dict[str, Any],
) -> list[dict]:
    return await svc.sync_allocations(db, user, project_id, body)


@router.post(
    "/{project_id}/allocations/{allocation_id}/end",
    dependencies=[Depends(_projects_write)],
)
async def end_allocation(
    db: DbSession,
    user: CurrentUser,
    project_id: uuid.UUID,
    allocation_id: uuid.UUID,
    body: dict[str, Any],
) -> dict:
    return await svc.end_allocation(db, user, project_id, allocation_id, body)
