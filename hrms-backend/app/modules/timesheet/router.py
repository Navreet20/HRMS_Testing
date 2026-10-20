import uuid

from fastapi import APIRouter, Depends, Query

from app.core.role_groups import TIMESHEET_ROLES
from app.dependencies import CurrentUser, require_roles
from app.modules.deps import DbSession
from app.schemas.common import CommentsBody
from app.modules.timesheet import week_service
from app.modules.timesheet.week_schemas import ApproveWeeksBody, SaveTimesheetWeekBody

router = APIRouter(tags=["Timesheets"])


@router.get(
    "/timesheet-weeks/me",
    dependencies=[Depends(require_roles(*TIMESHEET_ROLES))],
)
async def get_or_create_my_week(
    session: DbSession,
    user: CurrentUser,
    weekStartDate: str | None = Query(None, alias="weekStartDate"),
    create: bool = Query(True),
) -> dict:
    """Get or create the caller's Option A weekly Draft timesheet.

    Pass ``create=false`` to read an existing week only (copy-previous-week).
    """
    return await week_service.get_or_create_week(
        session, user, weekStartDate, create=create
    )


@router.get(
    "/timesheet-weeks/me/statuses",
    dependencies=[Depends(require_roles(*TIMESHEET_ROLES))],
)
async def list_my_week_statuses(
    session: DbSession,
    user: CurrentUser,
    from_date: str = Query(..., alias="from"),
    to_date: str = Query(..., alias="to"),
) -> list[dict]:
    """Status of the caller's saved weeks in a date range (calendar dots)."""
    return await week_service.list_my_week_statuses(session, user, from_date, to_date)


@router.get(
    "/timesheet-weeks/me/project-code-options",
    dependencies=[Depends(require_roles(*TIMESHEET_ROLES))],
)
async def get_my_project_code_options(session: DbSession, user: CurrentUser) -> dict:
    """TS-DATA-11 Option A cascade lists (allocated / internal / other)."""
    return await week_service.get_project_code_options(session, user)


@router.put(
    "/timesheet-weeks/{timesheet_id}",
    dependencies=[Depends(require_roles(*TIMESHEET_ROLES))],
)
async def save_my_week_draft(
    session: DbSession,
    user: CurrentUser,
    timesheet_id: uuid.UUID,
    body: SaveTimesheetWeekBody,
) -> dict:
    """Replace lines/entries on a Draft or Rejected week owned by the caller."""
    return await week_service.save_draft_week(session, user, timesheet_id, body)


@router.get(
    "/timesheet-weeks/queue",
    dependencies=[Depends(require_roles(*TIMESHEET_ROLES))],
)
async def weekly_approval_queue(
    session: DbSession,
    user: CurrentUser,
    status_filter: str = Query("Submitted", alias="status"),
) -> list[dict]:
    """TS-DATA-7 — Submitted weeks (FIFO) for reporting managers, HR, Admin, and Superadmin.

    ``status=Approved`` lists the last four weeks of approved weeks, which can
    still be rejected (TS-DATA-14).
    """
    return await week_service.approval_queue(session, user, status_filter)


@router.get(
    "/timesheet-weeks/lookup",
    dependencies=[Depends(require_roles(*TIMESHEET_ROLES))],
)
async def lookup_weekly_timesheet(
    session: DbSession,
    user: CurrentUser,
    employee_id: str = Query(..., alias="employeeId", min_length=1),
    week_start_date: str = Query(..., alias="weekStartDate"),
) -> dict:
    """TS-DATA-15 — lookup by EMP10001 (or UUID) + week start for manager, HR, Admin, Superadmin."""
    return await week_service.lookup_week(
        session,
        user,
        employee_id=employee_id,
        week_start_raw=week_start_date,
    )


@router.post(
    "/timesheet-weeks/{timesheet_id}/submit",
    dependencies=[Depends(require_roles(*TIMESHEET_ROLES))],
)
async def submit_weekly_timesheet(
    session: DbSession, user: CurrentUser, timesheet_id: uuid.UUID
) -> dict:
    """TS-DATA-3 — Draft or Rejected → Submitted."""
    return await week_service.submit_week(session, user, timesheet_id)


@router.post(
    "/timesheet-weeks/{timesheet_id}/recall",
    dependencies=[Depends(require_roles(*TIMESHEET_ROLES))],
)
async def recall_weekly_timesheet(
    session: DbSession, user: CurrentUser, timesheet_id: uuid.UUID
) -> dict:
    """TS-DATA-4 — Submitted → Draft."""
    return await week_service.recall_week(session, user, timesheet_id)


@router.post(
    "/timesheet-weeks/{timesheet_id}/approve",
    dependencies=[Depends(require_roles(*TIMESHEET_ROLES))],
)
async def approve_weekly_timesheet(
    session: DbSession, user: CurrentUser, timesheet_id: uuid.UUID
) -> dict:
    """TS-DATA-7 approve (+ TS-DATA-13 self-approval block)."""
    return await week_service.approve_week(session, user, timesheet_id)


@router.post(
    "/timesheet-weeks/approve-batch",
    dependencies=[Depends(require_roles(*TIMESHEET_ROLES))],
)
async def approve_weekly_timesheets_batch(
    session: DbSession,
    user: CurrentUser,
    body: ApproveWeeksBody,
) -> dict:
    """Approve several Submitted weeks in one request."""
    return await week_service.approve_weeks(session, user, body.timesheet_ids)


@router.post(
    "/timesheet-weeks/{timesheet_id}/reject",
    dependencies=[Depends(require_roles(*TIMESHEET_ROLES))],
)
async def reject_weekly_timesheet(
    session: DbSession,
    user: CurrentUser,
    timesheet_id: uuid.UUID,
    body: CommentsBody,
) -> dict:
    """TS-DATA-7 reject Submitted, or TS-DATA-14 reject already-Approved."""
    return await week_service.reject_week(
        session, user, timesheet_id, body.comments
    )
