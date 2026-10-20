import uuid
from typing import Any

from fastapi import APIRouter, Depends

from app.core.role_groups import TIMESHEET_ROLES
from app.dependencies import CurrentUser
from app.modules.deps import DbSession
from app.modules.org import service as svc
from app.modules.rbac.access import MODULE_KEY_COMPANY_SETUP, require_module_access
from app.modules.rbac.catalog import (
    SUBMODULE_KEY_DEPARTMENTS,
    SUBMODULE_KEY_DESIGNATIONS,
    SUBMODULE_KEY_LOCATIONS,
)
from app.modules.rbac.grants import ACCESS_LEVEL_FULL_ACCESS, ACCESS_LEVEL_READ_ONLY

router = APIRouter(tags=["Org"])


def _org_read(submodule_key: str):
    return require_module_access(
        MODULE_KEY_COMPANY_SETUP,
        submodule_key=submodule_key,
        min_level=ACCESS_LEVEL_READ_ONLY,
        legacy_roles=TIMESHEET_ROLES,
    )


def _org_write(submodule_key: str):
    return require_module_access(
        MODULE_KEY_COMPANY_SETUP,
        submodule_key=submodule_key,
        min_level=ACCESS_LEVEL_FULL_ACCESS,
        detail="You do not have access to create or change this. Ask an admin with Company Setup full access.",
    )


_departments_read = _org_read(SUBMODULE_KEY_DEPARTMENTS)
_departments_write = _org_write(SUBMODULE_KEY_DEPARTMENTS)
_locations_read = _org_read(SUBMODULE_KEY_LOCATIONS)
_locations_write = _org_write(SUBMODULE_KEY_LOCATIONS)
_designations_read = _org_read(SUBMODULE_KEY_DESIGNATIONS)
_designations_write = _org_write(SUBMODULE_KEY_DESIGNATIONS)


@router.get("/departments", dependencies=[Depends(_departments_read)])
async def list_departments(db: DbSession, user: CurrentUser) -> list[dict]:
    """Admin sees Active+Inactive. HR and other pickers see Active only."""
    return await svc.list_departments(
        db, user, include_inactive=svc.viewer_sees_inactive(user)
    )


@router.get(
    "/departments/{department_id}",
    dependencies=[Depends(_departments_read)],
)
async def get_department(db: DbSession, user: CurrentUser, department_id: uuid.UUID) -> dict:
    return await svc.get_department(
        db, user, department_id, include_inactive=svc.viewer_sees_inactive(user)
    )


@router.post("/departments", dependencies=[Depends(_departments_write)])
async def create_department(db: DbSession, user: CurrentUser, body: dict[str, Any]) -> dict:
    return await svc.create_department(db, user, body)


@router.patch("/departments/{department_id}", dependencies=[Depends(_departments_write)])
async def update_department(
    db: DbSession, user: CurrentUser, department_id: uuid.UUID, body: dict[str, Any]
) -> dict:
    """Admin: edit fields, or `{ "status": "Inactive" }` / `{ "status": "Active" }`."""
    return await svc.update_department(db, user, department_id, body)


@router.get("/locations", dependencies=[Depends(_locations_read)])
async def list_locations(db: DbSession, user: CurrentUser) -> list[dict]:
    return await svc.list_locations(db, user, include_inactive=svc.viewer_sees_inactive(user))


@router.get(
    "/locations/{location_id}",
    dependencies=[Depends(_locations_read)],
)
async def get_location(db: DbSession, user: CurrentUser, location_id: uuid.UUID) -> dict:
    return await svc.get_location(
        db, user, location_id, include_inactive=svc.viewer_sees_inactive(user)
    )


@router.post("/locations", dependencies=[Depends(_locations_write)])
async def create_location(db: DbSession, user: CurrentUser, body: dict[str, Any]) -> dict:
    return await svc.create_location(db, user, body)


@router.patch("/locations/{location_id}", dependencies=[Depends(_locations_write)])
async def update_location(
    db: DbSession, user: CurrentUser, location_id: uuid.UUID, body: dict[str, Any]
) -> dict:
    return await svc.update_location(db, user, location_id, body)


@router.get("/designations", dependencies=[Depends(_designations_read)])
async def list_designations(db: DbSession, user: CurrentUser) -> list[dict]:
    return await svc.list_designations(
        db, user, include_inactive=svc.viewer_sees_inactive(user)
    )


@router.get(
    "/designations/{designation_id}",
    dependencies=[Depends(_designations_read)],
)
async def get_designation(
    db: DbSession, user: CurrentUser, designation_id: uuid.UUID
) -> dict:
    return await svc.get_designation(
        db, user, designation_id, include_inactive=svc.viewer_sees_inactive(user)
    )


@router.post("/designations", dependencies=[Depends(_designations_write)])
async def create_designation(db: DbSession, user: CurrentUser, body: dict[str, Any]) -> dict:
    return await svc.create_designation(db, user, body)


@router.patch(
    "/designations/{designation_id}",
    dependencies=[Depends(_designations_write)],
)
async def update_designation(
    db: DbSession, user: CurrentUser, designation_id: uuid.UUID, body: dict[str, Any]
) -> dict:
    return await svc.update_designation(db, user, designation_id, body)
