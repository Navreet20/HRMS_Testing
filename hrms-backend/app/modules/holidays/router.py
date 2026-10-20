import uuid

from fastapi import APIRouter, Depends, Query

from app.core.role_groups import LEAVE_ADMIN_ROLES
from app.dependencies import CurrentUser
from app.modules.deps import DbSession
from app.modules.holidays import service as svc
from app.modules.holidays.schemas import HolidayBody
from app.modules.rbac.access import MODULE_KEY_COMPANY_SETUP, require_module_access
from app.modules.rbac.catalog import SUBMODULE_KEY_LEAVE_POLICY
from app.modules.rbac.grants import ACCESS_LEVEL_FULL_ACCESS

router = APIRouter(prefix="/holidays", tags=["Holidays"])

# Holidays are edited from the Leave Policy page.
_require_leave_admin = require_module_access(
    MODULE_KEY_COMPANY_SETUP,
    submodule_key=SUBMODULE_KEY_LEAVE_POLICY,
    min_level=ACCESS_LEVEL_FULL_ACCESS,
    legacy_roles=LEAVE_ADMIN_ROLES,
)


@router.get("")
async def list_holidays(
    db: DbSession,
    user: CurrentUser,
    year: int | None = Query(None),
) -> list[dict]:
    return await svc.list_holidays(db, user, year)


@router.post("", dependencies=[Depends(_require_leave_admin)])
async def create_holiday(db: DbSession, user: CurrentUser, body: HolidayBody) -> dict:
    return await svc.create_holiday(db, user, body)


@router.get("/{holiday_id}/delete-impact", dependencies=[Depends(_require_leave_admin)])
async def holiday_delete_impact(
    db: DbSession, user: CurrentUser, holiday_id: uuid.UUID
) -> dict:
    """How many leave requests deleting this holiday would change."""
    return await svc.holiday_delete_impact(db, user, holiday_id)


@router.delete("/{holiday_id}", dependencies=[Depends(_require_leave_admin)])
async def delete_holiday(db: DbSession, user: CurrentUser, holiday_id: uuid.UUID) -> dict:
    """Delete a current or future holiday; covered leave requests get the day back."""
    return await svc.delete_holiday(db, user, holiday_id)


@router.put("/{holiday_id}", dependencies=[Depends(_require_leave_admin)])
async def update_holiday(
    db: DbSession, user: CurrentUser, holiday_id: uuid.UUID, body: HolidayBody
) -> dict:
    return await svc.update_holiday(db, user, holiday_id, body)
