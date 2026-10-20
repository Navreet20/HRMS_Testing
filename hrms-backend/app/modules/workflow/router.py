"""Read a timesheet's, leave's or request's timeline."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.role_groups import (
    ESS_FUNCTIONAL_QUEUE_ROLES,
    LEAVE_ADMIN_ROLES,
    TIMESHEET_ORG_APPROVER_ROLES,
)
from app.core.roles import session_access_roles
from app.dependencies import CurrentUser
from app.models.tables import (Employee, LeaveRequest, TimesheetHeader)
from app.models.tables import AssetRequest, ProfileUpdateRequest
from app.modules.deps import DbSession
from app.modules.workflow.events import (
    ITEM_LEAVE,
    ITEM_PROFILE_UPDATE,
    ITEM_TIMESHEET,
    ITEM_TYPES,
    actor_of,
    list_events,
)

router = APIRouter(prefix="/workflow", tags=["Workflow"])

_ORG_ROLES = {
    role.value
    for group in (TIMESHEET_ORG_APPROVER_ROLES, LEAVE_ADMIN_ROLES, ESS_FUNCTIONAL_QUEUE_ROLES)
    for role in group
}


async def _owner_ids(
    session: AsyncSession, item_type: str, item_id: uuid.UUID
) -> tuple[uuid.UUID, uuid.UUID | None] | None:
    """(the employee it belongs to, who raised it) or None if it does not exist."""
    if item_type == ITEM_TIMESHEET:
        stmt = select(TimesheetHeader.employee_id).where(TimesheetHeader.timesheet_id == item_id)
    elif item_type == ITEM_LEAVE:
        stmt = select(LeaveRequest.employee_id).where(LeaveRequest.leave_request_id == item_id)
    elif item_type == ITEM_PROFILE_UPDATE:
        stmt = select(ProfileUpdateRequest.employee_id, ProfileUpdateRequest.submitted_by_employee_id).where(
            ProfileUpdateRequest.id == item_id
        )
    else:
        stmt = select(AssetRequest.employee_id, AssetRequest.submitted_by_employee_id).where(
            AssetRequest.id == item_id
        )
    row = (await session.execute(stmt)).first()
    if row is None:
        return None
    return row[0], (row[1] if len(row) > 1 else None)


async def can_view_history(
    session: AsyncSession, user: dict, owners: tuple[uuid.UUID, uuid.UUID | None]
) -> bool:
    """The people involved, the employee's manager, and HR / Admin."""
    actor_id, _ = actor_of(user)
    if actor_id is not None and actor_id in owners:
        return True
    if session_access_roles(user).intersection(_ORG_ROLES):
        return True
    if actor_id is None:
        return False
    manager_id = (
        await session.execute(
            select(Employee.reporting_manager_id).where(Employee.employee_id == owners[0])
        )
    ).scalar_one_or_none()
    return manager_id == actor_id


@router.get("/{item_type}/{item_id}/history")
async def item_history(
    session: DbSession, user: CurrentUser, item_type: str, item_id: uuid.UUID
) -> list[dict]:
    if item_type not in ITEM_TYPES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Unknown item type"
        )
    owners = await _owner_ids(session, item_type, item_id)
    if owners is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if not await can_view_history(session, user, owners):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot see this history",
        )
    return await list_events(session, item_type, item_id)
