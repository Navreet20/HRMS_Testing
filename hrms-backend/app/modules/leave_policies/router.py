import uuid

from fastapi import APIRouter, Depends, Query

from app.core.role_groups import HR_STAFF_ROLES, LEAVE_ADMIN_ROLES
from app.dependencies import CurrentUser, require_roles
from app.modules.deps import DbSession
from app.modules.leave_policies import service as svc
from app.modules.leave_policies.schemas import (
    LeavePolicyCreateBody,
    LeavePolicyDaysUpdateBody,
    LeavePolicyStatusBody,
)
from app.modules.rbac.access import MODULE_KEY_COMPANY_SETUP, require_module_access
from app.modules.rbac.catalog import SUBMODULE_KEY_LEAVE_POLICY
from app.modules.rbac.grants import ACCESS_LEVEL_FULL_ACCESS, ACCESS_LEVEL_READ_ONLY

router = APIRouter(prefix="/leave-policies", tags=["Leave Policies"])

_leave_policy_read = require_module_access(
    MODULE_KEY_COMPANY_SETUP,
    submodule_key=SUBMODULE_KEY_LEAVE_POLICY,
    min_level=ACCESS_LEVEL_READ_ONLY,
    legacy_roles=LEAVE_ADMIN_ROLES,
)
_require_leave_admin = require_module_access(
    MODULE_KEY_COMPANY_SETUP,
    submodule_key=SUBMODULE_KEY_LEAVE_POLICY,
    min_level=ACCESS_LEVEL_FULL_ACCESS,
    legacy_roles=LEAVE_ADMIN_ROLES,
)
_require_hr_staff = require_roles(*HR_STAFF_ROLES)


@router.get("", dependencies=[Depends(_leave_policy_read)])
async def list_leave_policies(
    db: DbSession,
    user: CurrentUser,
    include_inactive: bool = Query(True, alias="includeInactive"),
) -> list[dict]:
    return await svc.list_policies(db, user, include_inactive=include_inactive)


@router.get("/options", dependencies=[Depends(_require_hr_staff)])
async def list_leave_policy_options(
    db: DbSession,
    user: CurrentUser,
    include_policy_id: uuid.UUID | None = Query(None, alias="includePolicyId"),
) -> list[dict]:
    """Active leave policies for employee onboarding / Access assignment (DATA-5)."""
    return await svc.list_policy_options(
        db, user, include_policy_id=include_policy_id
    )


@router.get("/{policy_id}", dependencies=[Depends(_leave_policy_read)])
async def get_leave_policy(
    db: DbSession, user: CurrentUser, policy_id: uuid.UUID
) -> dict:
    return await svc.get_policy(db, user, policy_id)


@router.post("", dependencies=[Depends(_require_leave_admin)])
async def create_leave_policy(
    db: DbSession, user: CurrentUser, body: LeavePolicyCreateBody
) -> dict:
    return await svc.create_policy(db, user, body)


@router.patch("/{policy_id}/days", dependencies=[Depends(_require_leave_admin)])
async def update_leave_policy_days(
    db: DbSession,
    user: CurrentUser,
    policy_id: uuid.UUID,
    body: LeavePolicyDaysUpdateBody,
) -> dict:
    return await svc.update_policy_days(db, user, policy_id, body)


@router.patch("/{policy_id}/status", dependencies=[Depends(_require_leave_admin)])
async def update_leave_policy_status(
    db: DbSession,
    user: CurrentUser,
    policy_id: uuid.UUID,
    body: LeavePolicyStatusBody,
) -> dict:
    return await svc.update_policy_status(db, user, policy_id, body)
