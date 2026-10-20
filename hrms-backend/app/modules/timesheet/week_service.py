"""Option A weekly timesheet Draft APIs (Header / Line / Entry).

Leaves legacy ``Timesheet`` / ``TimesheetDetails`` service untouched.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.tables import (
    Allocation,
    Client,
    Company,
    Employee,
    LeaveType,
    Project,
    Timesheet as TimesheetHeader,
    TimesheetDayEntry,
    TimesheetItem,
)
from app.modules.timesheet import week_notify
from app.modules.workflow.waiting import waiting_on_label
from app.modules.workflow.events import (
    EVENT_APPROVED,
    EVENT_RECALLED,
    EVENT_REJECTED,
    EVENT_RESUBMITTED,
    EVENT_SUBMITTED,
    ITEM_TIMESHEET,
    record_event,
)
from app.modules.timesheet.day_markers import day_markers_for_week, day_markers_for_weeks
from app.modules.timesheet.constants import (
    MAX_TIMESHEET_LINES,
    ACTIVITY_TYPES,
    HOURS_MAX_PER_DAY,
    OTHER_TYPE_CATCH_ALL,
    OTHER_TYPE_CATCH_ALL_DB,
    OTHER_TYPES,
    PROJECT_CODE_CATEGORIES,
    PROJECT_CODE_CATEGORY_ALLOCATED,
    PROJECT_CODE_CATEGORY_INTERNAL,
    PROJECT_CODE_CATEGORY_ON_LEAVE,
    PROJECT_CODE_CATEGORY_OTHER,
    TIMESHEET_EDITABLE_STATUSES,
    TIMESHEET_LEAVE_TYPES,
    TIMESHEET_STATUS_APPROVED,
    TIMESHEET_STATUS_DRAFT,
    TIMESHEET_STATUS_REJECTED,
    TIMESHEET_STATUS_SUBMITTED,
)
from app.modules.leave.constants import MASTER_STATUS_ACTIVE
from app.core.role_groups import TIMESHEET_ORG_APPROVER_ROLES
from app.core.roles import Status, session_access_roles
from app.core.serialize import client_category_to_api
from app.modules.timesheet.utils import actor_display_name
from app.modules.timesheet.week_schemas import (
    ApproveWeeksBody,
    SaveTimesheetWeekBody,
    TimesheetLineInput,
)

DEFAULT_EXPECTED_WEEKLY_HOURS = 40.0


async def _hours_format(session: AsyncSession) -> str:
    """Company setting for how hours are typed and shown ("clock" or "decimal")."""
    result = await session.execute(select(Company.timesheet_hours_format).limit(1))
    return "decimal" if result.scalar_one_or_none() == "decimal" else "clock"


async def _expected_weekly_hours(session: AsyncSession) -> float:
    # New schema Company has no timesheet_expected_weekly_hours column.
    _ = session
    return DEFAULT_EXPECTED_WEEKLY_HOURS


def _employee_uuid(user: dict) -> uuid.UUID:
    raw = user.get("employeeId") or user.get("id")
    if not raw:
        raise HTTPException(status_code=400, detail="Authenticated user has no employee id")
    return uuid.UUID(str(raw))


def _week_end(header: TimesheetHeader) -> date:
    """Week end is derived (Saturday); the timesheets table does not store it."""
    return header.week_start_date + timedelta(days=6)


def _db_category(api_category: str) -> str:
    """Map API categories onto the 3 DB-allowed values."""
    if api_category in (PROJECT_CODE_CATEGORY_ALLOCATED, PROJECT_CODE_CATEGORY_INTERNAL):
        return PROJECT_CODE_CATEGORY_ALLOCATED
    return api_category


def _db_other_type(api_other: str | None) -> str | None:
    if not api_other:
        return None
    if api_other == OTHER_TYPE_CATCH_ALL:
        return OTHER_TYPE_CATCH_ALL_DB
    return api_other


def _api_other_type(db_other: str | None) -> str | None:
    if db_other == OTHER_TYPE_CATCH_ALL_DB:
        return OTHER_TYPE_CATCH_ALL
    return db_other


def _parse_employee_uuid(raw: str) -> uuid.UUID | None:
    try:
        return uuid.UUID(raw)
    except ValueError:
        return None


async def resolve_timesheet_employee_id(
    session: AsyncSession, raw: str | uuid.UUID
) -> uuid.UUID:
    """Accept a UUID or official business id (EMP10001)."""
    if isinstance(raw, uuid.UUID):
        return raw
    token = raw.strip()
    if not token:
        raise HTTPException(status_code=400, detail="employeeId is required")
    parsed = _parse_employee_uuid(token)
    if parsed is not None:
        return parsed
    result = await session.execute(
        select(Employee.id).where(
            func.lower(Employee.business_employee_id) == token.lower()
        )
    )
    found = result.scalar_one_or_none()
    if found is None:
        raise HTTPException(
            status_code=404,
            detail=f"No employee found for {token}",
        )
    return found


def _project_selection_code(project: Project) -> str:
    raw = (
        (project.project_code or "").strip()
        or (getattr(project, "project_number", None) or "").strip()
        or (project.name or "").strip()
    )
    return raw


async def _allocated_project_ids_for_employee(
    session: AsyncSession, employee_id: uuid.UUID
) -> dict[str, uuid.UUID]:
    """Selection code (project_code, else project_number, else name) -> project id."""
    codes: dict[str, uuid.UUID] = {}
    alloc_result = await session.execute(
        select(Allocation, Project)
        .join(Project, Project.id == Allocation.project_id)
        .where(Allocation.employee_id == employee_id)
    )
    for _allocation, project in alloc_result.all():
        code = _project_selection_code(project)
        if code:
            codes.setdefault(code, project.id)
    return codes


def _is_internal_project(project: Project, client_category: str | None) -> bool:
    return (client_category or "").strip().upper() == "INTERNAL" or (
        (project.project_type or "").strip().lower() == "internal"
    )


def _project_option_payload(project: Project, *, source: str) -> dict | None:
    code = _project_selection_code(project)
    if not code:
        return None
    return {
        "code": code,
        "label": (project.name or "").strip() or code,
        "projectId": str(project.id),
        "source": source,
    }


def _is_inactive_project(project: Project) -> bool:
    return (project.status or "").strip().upper() in ("INACTIVE", "CLOSED")


async def _internal_project_options(session: AsyncSession) -> list[dict]:
    """Projects on an INTERNAL client, or marked project_type Internal."""
    result = await session.execute(
        select(Project)
        .outerjoin(Client, Client.id == Project.client_id)
        .where(
            or_(
                Client.client_category == "INTERNAL",
                func.lower(func.coalesce(Project.project_type, "")) == "internal",
            )
        )
        .order_by(Project.name.asc())
    )
    options: list[dict] = []
    seen_codes: set[str] = set()
    for project in result.scalars().unique().all():
        if _is_inactive_project(project):
            continue
        payload = _project_option_payload(project, source="internal_project")
        if payload is None or payload["code"] in seen_codes:
            continue
        seen_codes.add(payload["code"])
        options.append(payload)
    return options


def sunday_of_week(day: date) -> date:
    """Return the Sunday that starts the week containing ``day``."""
    days_since_sunday = (day.weekday() + 1) % 7
    return day - timedelta(days=days_since_sunday)


def parse_iso_date(raw: str) -> date:
    try:
        return date.fromisoformat(raw.strip()[:10])
    except ValueError as exc:
        raise HTTPException(
            status_code=400, detail="weekStartDate must be YYYY-MM-DD"
        ) from exc


def _employee_display_name(emp: Employee | None) -> str | None:
    if emp is None:
        return None
    first = (emp.first_name or "").strip()
    last = (emp.last_name or "").strip()
    name = f"{first} {last}".strip()
    return name or None


class _DisplayLookups:
    """Names/codes that timesheet_items only store as ids (project_id, leave_type_id)."""

    def __init__(self) -> None:
        self.project_codes: dict[uuid.UUID, str] = {}
        self.internal_project_ids: set[uuid.UUID] = set()
        self.leave_names: dict[uuid.UUID, str] = {}


async def _display_lookups(
    session: AsyncSession, headers: list[TimesheetHeader]
) -> _DisplayLookups:
    lookups = _DisplayLookups()
    project_ids: set[uuid.UUID] = set()
    leave_type_ids: set[uuid.UUID] = set()
    for header in headers:
        for item in header.items or []:
            if item.project_id:
                project_ids.add(item.project_id)
            if item.leave_type_id:
                leave_type_ids.add(item.leave_type_id)
    if project_ids:
        rows = (
            await session.execute(
                select(Project, Client.client_category)
                .outerjoin(Client, Client.id == Project.client_id)
                .where(Project.id.in_(project_ids))
            )
        ).all()
        for project, client_category in rows:
            lookups.project_codes[project.id] = _project_selection_code(project)
            if _is_internal_project(project, client_category):
                lookups.internal_project_ids.add(project.id)
    if leave_type_ids:
        rows = (
            await session.execute(
                select(LeaveType.id, LeaveType.name).where(LeaveType.id.in_(leave_type_ids))
            )
        ).all()
        lookups.leave_names = {lt_id: name for lt_id, name in rows}
    return lookups


def _header_to_dict(
    header: TimesheetHeader,
    employee: Employee | None = None,
    *,
    expected_weekly_hours: float = DEFAULT_EXPECTED_WEEKLY_HOURS,
    hours_format: str = "clock",
    approved_by_name: str | None = None,
    day_markers: list[dict] | None = None,
    waiting_on: str | None = None,
    lookups: _DisplayLookups | None = None,
) -> dict:
    lookups = lookups or _DisplayLookups()
    lines_out: list[dict] = []
    for item in header.items or []:
        entries_out = [
            {
                "entryId": str(entry.id),
                "workDate": entry.work_date.isoformat(),
                "hours": float(entry.hours or 0),
                "comment": (entry.comment or "").strip() or None,
            }
            for entry in sorted(item.day_entries or [], key=lambda e: e.work_date)
        ]
        category = item.category
        if category == PROJECT_CODE_CATEGORY_ALLOCATED and (
            item.project_id in lookups.internal_project_ids
        ):
            category = PROJECT_CODE_CATEGORY_INTERNAL
        billable = bool(item.billable) if item.category == PROJECT_CODE_CATEGORY_ALLOCATED else False
        lines_out.append(
            {
                "lineId": str(item.id),
                "projectCodeCategory": category,
                "projectCode": lookups.project_codes.get(item.project_id)
                if item.project_id
                else None,
                "activityType": item.activity_type,
                "leaveType": lookups.leave_names.get(item.leave_type_id)
                if item.leave_type_id
                else None,
                "otherType": _api_other_type(item.other_type),
                "otherComment": item.other_comment,
                "billable": billable,
                "entries": entries_out,
            }
        )
    approved = header.status == TIMESHEET_STATUS_APPROVED
    decided_by = header.decided_by_employee_id
    decided_at = header.decided_at
    return {
        "timesheetId": str(header.id),
        "employeeId": str(header.employee_id),
        "businessEmployeeId": (
            (employee.business_employee_id or "").strip() or None
            if employee is not None
            else None
        ),
        "employeeName": _employee_display_name(employee),
        "weekStartDate": header.week_start_date.isoformat(),
        "weekEndDate": _week_end(header).isoformat(),
        "status": header.status,
        "submittedDate": header.submitted_at.isoformat() if header.submitted_at else None,
        "approvedBy": str(decided_by) if decided_by and approved else None,
        "approvedByName": approved_by_name if approved else None,
        "approvedDate": decided_at.isoformat() if decided_at and approved else None,
        "decidedBy": str(decided_by) if decided_by else None,
        "decidedByName": approved_by_name,
        "decidedAt": decided_at.isoformat() if decided_at else None,
        "rejectionComment": header.rejection_comment,
        # The new schema has no reopened_from_approved column.
        "reopenedFromApproved": False,
        "expectedWeeklyHours": float(expected_weekly_hours),
        "hoursFormat": hours_format,
        "dayMarkers": day_markers or [],
        "waitingOn": waiting_on,
        "lines": lines_out,
    }


async def _serialize_header(
    session: AsyncSession,
    header: TimesheetHeader,
    employee: Employee | None = None,
    *,
    user: dict,
) -> dict:
    expected = await _expected_weekly_hours(session)
    hours_format = await _hours_format(session)
    lookups = await _display_lookups(session, [header])
    approver_name = None
    if header.decided_by_employee_id:
        approver_name = _employee_display_name(
            await session.get(Employee, header.decided_by_employee_id)
        )
    if employee is None:
        employee = await session.get(Employee, header.employee_id)
    own_submitted = header.status == TIMESHEET_STATUS_SUBMITTED and str(
        header.employee_id
    ) == str(user.get("employeeId"))
    return _header_to_dict(
        header,
        employee,
        expected_weekly_hours=expected,
        hours_format=hours_format,
        approved_by_name=approver_name,
        day_markers=await day_markers_for_week(
            session, user, header.employee_id, header.week_start_date
        ),
        waiting_on=await waiting_on_label(session, employee) if own_submitted else None,
        lookups=lookups,
    )


def _load_options():
    return selectinload(TimesheetHeader.items).selectinload(TimesheetItem.day_entries)


async def _load_header(
    session: AsyncSession, timesheet_id: uuid.UUID
) -> TimesheetHeader | None:
    result = await session.execute(
        select(TimesheetHeader)
        .where(TimesheetHeader.id == timesheet_id)
        .options(_load_options())
        .execution_options(populate_existing=True)
    )
    return result.scalar_one_or_none()


async def list_my_week_statuses(
    session: AsyncSession,
    user: dict,
    from_raw: str,
    to_raw: str,
) -> list[dict]:
    """Status of each of the caller's saved weeks starting between two dates."""
    employee_id = _employee_uuid(user)
    start = sunday_of_week(parse_iso_date(from_raw))
    end = parse_iso_date(to_raw)
    if end < start or (end - start).days > 400:
        raise HTTPException(status_code=400, detail="Pick a range of at most one year.")
    result = await session.execute(
        select(
            TimesheetHeader.week_start_date,
            TimesheetHeader.status,
            select(func.count(TimesheetItem.id))
            .where(TimesheetItem.timesheet_id == TimesheetHeader.id)
            .scalar_subquery(),
        )
        .where(
            TimesheetHeader.employee_id == employee_id,
            TimesheetHeader.week_start_date >= start,
            TimesheetHeader.week_start_date <= end,
        )
        .order_by(TimesheetHeader.week_start_date)
    )
    # An opened-but-empty Draft week has nothing saved, so it gets no status.
    return [
        {"weekStartDate": week_start.isoformat(), "status": status}
        for week_start, status, line_count in result.all()
        if status != TIMESHEET_STATUS_DRAFT or line_count
    ]


async def get_or_create_week(
    session: AsyncSession,
    user: dict,
    week_start_raw: str | None,
    *,
    create: bool = True,
) -> dict:
    employee_id = _employee_uuid(user)
    if week_start_raw:
        requested = parse_iso_date(week_start_raw)
        week_start = sunday_of_week(requested)
    else:
        week_start = sunday_of_week(date.today())
    week_end = week_start + timedelta(days=6)

    result = await session.execute(
        select(TimesheetHeader)
        .where(
            TimesheetHeader.employee_id == employee_id,
            TimesheetHeader.week_start_date == week_start,
        )
        .options(_load_options())
    )
    header = result.scalar_one_or_none()
    if header is None:
        if not create:
            raise HTTPException(
                status_code=404,
                detail="No timesheet for that week",
            )
        _ = week_end  # derived in serializers; not stored on timesheets
        header = TimesheetHeader(
            employee_id=employee_id,
            week_start_date=week_start,
            status=TIMESHEET_STATUS_DRAFT,
        )
        session.add(header)
        await session.flush()
        # Re-load with selectinload so we never lazy-load lines under async.
        result = await session.execute(
            select(TimesheetHeader)
            .where(TimesheetHeader.id == header.id)
            .options(_load_options())
        )
        header = result.scalar_one()

    return await _serialize_header(session, header, user=user)


async def _leave_type_ids_by_name(session: AsyncSession) -> dict[str, uuid.UUID]:
    """Leave type name -> id (names are unique ignoring case)."""
    result = await session.execute(
        select(LeaveType.name, LeaveType.id).order_by(LeaveType.name.asc())
    )
    return {str(name): lt_id for name, lt_id in result.all() if name}


async def _active_leave_type_names(session: AsyncSession) -> list[str]:
    """Leave type names for the On Leave cascade (LEAVE-DATA-1)."""
    names = list((await _leave_type_ids_by_name(session)).keys())
    return names if names else list(TIMESHEET_LEAVE_TYPES)


async def get_project_code_options(session: AsyncSession, user: dict) -> dict:
    """TS-DATA-11 cascade lists for the authenticated employee."""
    employee_id = _employee_uuid(user)
    allocated: list[dict] = []
    seen_codes: set[str] = set()

    alloc_result = await session.execute(
        select(Allocation, Project, Client)
        .join(Project, Project.id == Allocation.project_id)
        .outerjoin(Client, Client.id == Project.client_id)
        .where(Allocation.employee_id == employee_id)
        .order_by(Project.name.asc())
    )
    for _allocation, project, client in alloc_result.all():
        code = _project_selection_code(project)
        if not code or code in seen_codes:
            continue
        seen_codes.add(code)
        allocated.append(
            {
                "code": code,
                "label": project.name,
                "projectId": str(project.id),
                "source": "allocation",
                "clientName": client.client_name if client is not None else None,
                "clientCategory": (
                    client_category_to_api(client.client_category)
                    if client is not None
                    else None
                ),
            }
        )

    return {
        "categories": sorted(PROJECT_CODE_CATEGORIES),
        "allocatedProjects": allocated,
        "internalProjectCodes": await _internal_project_options(session),
        "otherTypes": list(OTHER_TYPES),
        "activityTypes": list(ACTIVITY_TYPES),
        "leaveTypes": await _active_leave_type_names(session),
    }


def _validate_line_skeleton(
    line: TimesheetLineInput,
    *,
    allocated_codes: set[str],
    internal_codes: set[str],
    activity_types: set[str] | frozenset[str] | tuple[str, ...] = ACTIVITY_TYPES,
    leave_types: set[str] | frozenset[str] | tuple[str, ...] = TIMESHEET_LEAVE_TYPES,
) -> None:
    category = line.project_code_category.strip()
    if category not in PROJECT_CODE_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid projectCodeCategory: {line.project_code_category}",
        )

    project_code = (line.project_code or "").strip() or None
    other_type = (line.other_type or "").strip() or None
    leave_type = (line.leave_type or "").strip() or None
    activity_type = (line.activity_type or "").strip() or None
    other_comment = (line.other_comment or "").strip() or None

    if category == PROJECT_CODE_CATEGORY_ALLOCATED:
        if other_type or leave_type:
            raise HTTPException(
                status_code=400,
                detail="Allocated Projects rows cannot set otherType or leaveType",
            )
        if not project_code:
            raise HTTPException(
                status_code=400,
                detail="projectCode is required for Allocated Projects",
            )
        if project_code not in allocated_codes:
            raise HTTPException(
                status_code=400,
                detail=f"Stale or unknown allocated project code: {project_code}",
            )
        if not activity_type:
            raise HTTPException(
                status_code=400,
                detail="activityType is required for Allocated Projects",
            )
        if activity_type not in activity_types:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown activityType: {activity_type}",
            )
    elif category == PROJECT_CODE_CATEGORY_INTERNAL:
        if other_type or leave_type:
            raise HTTPException(
                status_code=400,
                detail="Internal Project Codes rows cannot set otherType or leaveType",
            )
        if not project_code:
            raise HTTPException(
                status_code=400,
                detail="projectCode is required for Internal Project Codes",
            )
        if project_code not in internal_codes:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown internal project code: {project_code}",
            )
        if not activity_type:
            raise HTTPException(
                status_code=400,
                detail="activityType is required for Internal Project Codes",
            )
        if activity_type not in activity_types:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown activityType: {activity_type}",
            )
    elif category == PROJECT_CODE_CATEGORY_ON_LEAVE:
        if project_code or other_type or activity_type:
            raise HTTPException(
                status_code=400,
                detail="On Leave rows cannot set projectCode, otherType, or activityType",
            )
        if not leave_type:
            raise HTTPException(
                status_code=400,
                detail="leaveType is required for On Leave",
            )
        if leave_type not in leave_types:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown leaveType: {leave_type}",
            )
    elif category == PROJECT_CODE_CATEGORY_OTHER:
        if project_code or leave_type or activity_type:
            raise HTTPException(
                status_code=400,
                detail="Other rows cannot set projectCode, leaveType, or activityType",
            )
        if not other_type:
            raise HTTPException(
                status_code=400,
                detail="otherType is required for Other",
            )
        if other_type not in OTHER_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown otherType: {other_type}",
            )
        if other_type in (OTHER_TYPE_CATCH_ALL, OTHER_TYPE_CATCH_ALL_DB) and not other_comment:
            raise HTTPException(
                status_code=400,
                detail="otherComment is required when otherType is Other",
            )


def _validate_entry_work_dates_and_day_caps(
    lines: list[TimesheetLineInput],
    week_start: date,
    week_end: date,
) -> None:
    day_totals: dict[date, Decimal] = {}
    for line_in in lines:
        for entry in line_in.entries:
            work_date = parse_iso_date(entry.work_date)
            if work_date < week_start or work_date > week_end:
                raise HTTPException(
                    status_code=400,
                    detail=f"workDate {entry.work_date} is outside the timesheet week",
                )
            hours = Decimal(str(entry.hours))
            day_totals[work_date] = day_totals.get(work_date, Decimal("0")) + hours

    for work_date, total in sorted(day_totals.items()):
        if total > HOURS_MAX_PER_DAY:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Day total for {work_date.isoformat()} is {total} hours; "
                    f"maximum is {HOURS_MAX_PER_DAY}"
                ),
            )


async def save_draft_week(
    session: AsyncSession,
    user: dict,
    timesheet_id: uuid.UUID,
    body: SaveTimesheetWeekBody,
) -> dict:
    employee_id = _employee_uuid(user)
    header = await _load_header(session, timesheet_id)
    if header is None:
        raise HTTPException(status_code=404, detail="Timesheet week not found")
    if header.employee_id != employee_id:
        raise HTTPException(status_code=403, detail="Not timesheet owner")
    if header.status not in TIMESHEET_EDITABLE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Only Draft or Rejected timesheets can be edited",
        )

    if len(body.lines) > MAX_TIMESHEET_LINES and len(body.lines) > len(header.items):
        raise HTTPException(
            status_code=400,
            detail=f"A week can have at most {MAX_TIMESHEET_LINES} rows",
        )

    allocated_ids = await _allocated_project_ids_for_employee(session, employee_id)
    internal_ids: dict[str, uuid.UUID] = {}
    for option in await _internal_project_options(session):
        internal_ids.setdefault(option["code"], uuid.UUID(option["projectId"]))
    leave_ids = await _leave_type_ids_by_name(session)
    leave_ids_lower = {name.lower(): lt_id for name, lt_id in leave_ids.items()}
    leave_names = tuple(leave_ids) or tuple(TIMESHEET_LEAVE_TYPES)
    for line_in in body.lines:
        _validate_line_skeleton(
            line_in,
            allocated_codes=set(allocated_ids),
            internal_codes=set(internal_ids),
            leave_types=leave_names,
        )
    _validate_entry_work_dates_and_day_caps(
        body.lines, header.week_start_date, _week_end(header)
    )

    # Resolve names/codes to ids before touching the existing rows.
    resolved: list[tuple[TimesheetItem, list[TimesheetDayEntry]]] = []
    for sort_order, line_in in enumerate(body.lines):
        api_category = line_in.project_code_category.strip()
        db_category = _db_category(api_category)
        project_code = (line_in.project_code or "").strip() or None
        leave_type_name = (line_in.leave_type or "").strip() or None
        project_id: uuid.UUID | None = None
        leave_type_id: uuid.UUID | None = None
        activity_type: str | None = None
        other_type: str | None = None
        other_comment: str | None = None
        if db_category == PROJECT_CODE_CATEGORY_ALLOCATED:
            source = (
                internal_ids
                if api_category == PROJECT_CODE_CATEGORY_INTERNAL
                else allocated_ids
            )
            project_id = source[project_code or ""]
            activity_type = (line_in.activity_type or "").strip() or None
        elif db_category == PROJECT_CODE_CATEGORY_ON_LEAVE:
            leave_type_id = leave_ids_lower.get((leave_type_name or "").lower())
            if leave_type_id is None:
                raise HTTPException(
                    status_code=400, detail=f"Unknown leaveType: {leave_type_name}"
                )
        else:  # Other
            other_type = _db_other_type((line_in.other_type or "").strip() or None)
            other_comment = (line_in.other_comment or "").strip() or None

        seen_dates: set[date] = set()
        entries: list[TimesheetDayEntry] = []
        for entry_in in line_in.entries:
            work_date = parse_iso_date(entry_in.work_date)
            if work_date in seen_dates:
                raise HTTPException(
                    status_code=400,
                    detail=f"Duplicate workDate {work_date.isoformat()} on one row",
                )
            seen_dates.add(work_date)
            entries.append(
                TimesheetDayEntry(
                    work_date=work_date,
                    hours=Decimal(str(round(float(entry_in.hours), 2))),
                    comment=(entry_in.comment or None),
                )
            )
        item = TimesheetItem(
            category=db_category,
            project_id=project_id,
            activity_type=activity_type,
            leave_type_id=leave_type_id,
            other_type=other_type,
            other_comment=other_comment,
            billable=bool(line_in.billable) if api_category == PROJECT_CODE_CATEGORY_ALLOCATED else False,
            sort_order=sort_order,
        )
        resolved.append((item, entries))

    # delete-orphan cascade removes the old items and their day entries.
    header.items.clear()
    await session.flush()
    for item, entries in resolved:
        item.timesheet_id = header.id
        item.day_entries = entries
        session.add(item)
    await session.flush()

    # Expire so the follow-up selectinload is not served from stale collections.
    session.expire(header)
    reloaded = await _load_header(session, timesheet_id)
    assert reloaded is not None
    return await _serialize_header(session, reloaded, user=user)


def assert_editable(header: TimesheetHeader) -> None:
    """TS-DATA-5 — block edits on Submitted and Approved."""
    if header.status not in TIMESHEET_EDITABLE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Timesheet with status {header.status} is not editable",
        )


async def _require_employee(
    session: AsyncSession, employee_id: uuid.UUID
) -> Employee:
    result = await session.execute(
        select(Employee).where(Employee.id == employee_id)
    )
    emp = result.scalar_one_or_none()
    if emp is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    return emp


def can_org_approve_timesheets(user: dict) -> bool:
    """HR, Admin, and Superadmin (SUPERADMIN) may review any employee's week."""
    allowed = {role.value for role in TIMESHEET_ORG_APPROVER_ROLES}
    return bool(session_access_roles(user).intersection(allowed))


async def _assert_direct_report(
    session: AsyncSession,
    *,
    manager_id: uuid.UUID,
    employee_id: uuid.UUID,
) -> Employee:
    emp = await _require_employee(session, employee_id)
    if emp.reporting_manager_id != manager_id:
        raise HTTPException(
            status_code=403,
            detail="Employee is not a direct report of this manager",
        )
    return emp


async def _assert_can_review_timesheet(
    session: AsyncSession,
    user: dict,
    *,
    reviewer_id: uuid.UUID,
    employee_id: uuid.UUID,
) -> Employee:
    if can_org_approve_timesheets(user):
        return await _require_employee(session, employee_id)
    return await _assert_direct_report(
        session, manager_id=reviewer_id, employee_id=employee_id
    )


async def submit_week(
    session: AsyncSession, user: dict, timesheet_id: uuid.UUID
) -> dict:
    """TS-DATA-3 — Draft or Rejected → Submitted."""
    employee_id = _employee_uuid(user)
    header = await _load_header(session, timesheet_id)
    if header is None:
        raise HTTPException(status_code=404, detail="Timesheet week not found")
    if header.employee_id != employee_id:
        raise HTTPException(status_code=403, detail="Not timesheet owner")
    if header.status not in TIMESHEET_EDITABLE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Only Draft or Rejected timesheets can be submitted",
        )
    if not header.items:
        raise HTTPException(
            status_code=400,
            detail="Cannot submit a timesheet with no rows",
        )

    # A week coming back from a rejection is a resubmission on the timeline.
    resubmitting = header.status == TIMESHEET_STATUS_REJECTED
    header.status = TIMESHEET_STATUS_SUBMITTED
    header.submitted_at = datetime.now(timezone.utc)
    header.rejection_comment = None
    header.decided_by_employee_id = None
    header.decided_at = None
    record_event(
        session,
        item_type=ITEM_TIMESHEET,
        item_id=header.id,
        event=EVENT_RESUBMITTED if resubmitting else EVENT_SUBMITTED,
        user=user,
    )
    await session.flush()

    employee = await _require_employee(session, header.employee_id)
    await week_notify.notify_manager_timesheet_submitted(
        session,
        employee=employee,
        manager_id=getattr(employee, "reporting_manager_id", None),
        week_start_date=header.week_start_date,
        week_end_date=_week_end(header),
    )
    return await _serialize_header(session, header, employee, user=user)


async def recall_week(
    session: AsyncSession, user: dict, timesheet_id: uuid.UUID
) -> dict:
    """TS-DATA-4 — Submitted → Draft."""
    employee_id = _employee_uuid(user)
    header = await _load_header(session, timesheet_id)
    if header is None:
        raise HTTPException(status_code=404, detail="Timesheet week not found")
    if header.employee_id != employee_id:
        raise HTTPException(status_code=403, detail="Not timesheet owner")
    if header.status != TIMESHEET_STATUS_SUBMITTED:
        raise HTTPException(
            status_code=400,
            detail="Only Submitted timesheets can be recalled",
        )

    header.status = TIMESHEET_STATUS_DRAFT
    header.submitted_at = None
    record_event(
        session,
        item_type=ITEM_TIMESHEET,
        item_id=header.id,
        event=EVENT_RECALLED,
        user=user,
    )
    await session.flush()

    employee = await _require_employee(session, header.employee_id)
    return await _serialize_header(session, header, employee, user=user)


# Approved weeks stay in the manager's list this long, so a mistake can still be rejected.
APPROVED_LOOKBACK_DAYS = 28


async def count_waiting(session: AsyncSession, user: dict) -> int:
    """How many Submitted weeks are waiting for this person (same scope as the queue)."""
    org_approver = can_org_approve_timesheets(user)
    raw = user.get("employeeId") or user.get("id")
    # Allowlist Superadmin has no employee row; org approvers still see the full queue.
    if not raw:
        if not org_approver:
            raise HTTPException(
                status_code=400, detail="Authenticated user has no employee id"
            )
        stmt = (
            select(func.count())
            .select_from(TimesheetHeader)
            .where(TimesheetHeader.status == TIMESHEET_STATUS_SUBMITTED)
        )
        return int((await session.execute(stmt)).scalar_one())

    reviewer_id = uuid.UUID(str(raw))
    stmt = (
        select(func.count())
        .select_from(TimesheetHeader)
        .join(Employee, Employee.id == TimesheetHeader.employee_id)
        .where(
            TimesheetHeader.status == TIMESHEET_STATUS_SUBMITTED,
            TimesheetHeader.employee_id != reviewer_id,
        )
    )
    if not org_approver:
        stmt = stmt.where(Employee.reporting_manager_id == reviewer_id)
    return int((await session.execute(stmt)).scalar_one())

async def approval_queue(
    session: AsyncSession,
    user: dict,
    status_filter: str = TIMESHEET_STATUS_SUBMITTED,
) -> list[dict]:
    """Submitted weeks, oldest first; or recently Approved weeks, newest first.

    Direct reports for a manager, everyone for HR / Admin / Superadmin.
    """
    if status_filter not in (TIMESHEET_STATUS_SUBMITTED, TIMESHEET_STATUS_APPROVED):
        raise HTTPException(
            status_code=400, detail="status must be Submitted or Approved"
        )
    org_approver = can_org_approve_timesheets(user)
    raw = user.get("employeeId") or user.get("id")
    if not raw:
        if not org_approver:
            raise HTTPException(
                status_code=400, detail="Authenticated user has no employee id"
            )
        reviewer_id = None
    else:
        reviewer_id = uuid.UUID(str(raw))
    filters = [TimesheetHeader.status == status_filter]
    if reviewer_id is not None:
        filters.append(TimesheetHeader.employee_id != reviewer_id)
    if status_filter == TIMESHEET_STATUS_APPROVED:
        # week_end is derived: keep weeks whose start is within lookback+6 days.
        filters.append(
            TimesheetHeader.week_start_date
            >= date.today() - timedelta(days=APPROVED_LOOKBACK_DAYS + 6)
        )
    if not org_approver:
        filters.append(Employee.reporting_manager_id == reviewer_id)
    order = (
        (
            TimesheetHeader.decided_at.desc().nulls_last(),
            TimesheetHeader.id.asc(),
        )
        if status_filter == TIMESHEET_STATUS_APPROVED
        else (
            TimesheetHeader.submitted_at.asc().nulls_last(),
            TimesheetHeader.id.asc(),
        )
    )
    result = await session.execute(
        select(TimesheetHeader, Employee)
        .join(Employee, Employee.id == TimesheetHeader.employee_id)
        .where(*filters)
        .order_by(*order)
        .options(_load_options())
    )
    expected = await _expected_weekly_hours(session)
    hours_format = await _hours_format(session)
    pairs = result.all()
    markers = await day_markers_for_weeks(
        session,
        user,
        [(header.employee_id, header.week_start_date) for header, _ in pairs],
    )
    lookups = await _display_lookups(session, [header for header, _ in pairs])
    return [
        _header_to_dict(
            header,
            emp,
            expected_weekly_hours=expected,
            hours_format=hours_format,
            day_markers=markers.get((header.employee_id, header.week_start_date)),
            lookups=lookups,
        )
        for header, emp in pairs
    ]


async def approve_week(
    session: AsyncSession, user: dict, timesheet_id: uuid.UUID
) -> dict:
    """TS-DATA-7 approve + TS-DATA-13 self-approval block."""
    manager_id = _employee_uuid(user)
    header = await _load_header(session, timesheet_id)
    if header is None:
        raise HTTPException(status_code=404, detail="Timesheet week not found")
    if header.employee_id == manager_id:
        raise HTTPException(
            status_code=403,
            detail="Managers cannot approve their own timesheet",
        )
    if header.status != TIMESHEET_STATUS_SUBMITTED:
        raise HTTPException(
            status_code=400,
            detail="Only Submitted timesheets can be approved",
        )

    employee = await _assert_can_review_timesheet(
        session,
        user,
        reviewer_id=manager_id,
        employee_id=header.employee_id,
    )

    header.status = TIMESHEET_STATUS_APPROVED
    header.decided_by_employee_id = manager_id
    header.decided_at = datetime.now(timezone.utc)
    header.rejection_comment = None
    record_event(
        session,
        item_type=ITEM_TIMESHEET,
        item_id=header.id,
        event=EVENT_APPROVED,
        user=user,
    )
    await session.flush()

    await week_notify.notify_employee_timesheet_approved(
        session,
        employee=employee,
        week_start_date=header.week_start_date,
        week_end_date=_week_end(header),
    )
    return await _serialize_header(session, header, employee, user=user)


async def approve_weeks(
    session: AsyncSession,
    user: dict,
    timesheet_ids: list[uuid.UUID],
) -> dict:
    """Approve several Submitted weeks; skip duplicates and collect failures."""
    approved: list[dict] = []
    failed: list[dict] = []
    seen: set[uuid.UUID] = set()
    for timesheet_id in timesheet_ids:
        if timesheet_id in seen:
            continue
        seen.add(timesheet_id)
        try:
            payload = await approve_week(session, user, timesheet_id)
            approved.append(payload)
        except HTTPException as exc:
            failed.append(
                {
                    "timesheetId": str(timesheet_id),
                    "detail": exc.detail,
                    "status": exc.status_code,
                }
            )
    return {"approved": approved, "failed": failed}


async def reject_week(
    session: AsyncSession,
    user: dict,
    timesheet_id: uuid.UUID,
    comments: str,
) -> dict:
    """TS-DATA-7 reject Submitted, or TS-DATA-14 reject already-Approved."""
    trimmed = (comments or "").strip()
    if not trimmed:
        raise HTTPException(
            status_code=400,
            detail="Rejection comment is required",
        )
    if len(trimmed) > 255:
        raise HTTPException(
            status_code=400,
            detail="Rejection comment must be at most 255 characters",
        )

    manager_id = _employee_uuid(user)
    header = await _load_header(session, timesheet_id)
    if header is None:
        raise HTTPException(status_code=404, detail="Timesheet week not found")
    if header.employee_id == manager_id:
        raise HTTPException(
            status_code=403,
            detail="Managers cannot reject their own timesheet",
        )
    if header.status not in (
        TIMESHEET_STATUS_SUBMITTED,
        TIMESHEET_STATUS_APPROVED,
    ):
        raise HTTPException(
            status_code=400,
            detail="Only Submitted or Approved timesheets can be rejected",
        )

    employee = await _assert_can_review_timesheet(
        session,
        user,
        reviewer_id=manager_id,
        employee_id=header.employee_id,
    )

    header.status = TIMESHEET_STATUS_REJECTED
    header.rejection_comment = trimmed
    header.decided_by_employee_id = manager_id
    header.decided_at = datetime.now(timezone.utc)
    record_event(
        session,
        item_type=ITEM_TIMESHEET,
        item_id=header.id,
        event=EVENT_REJECTED,
        user=user,
        comment=trimmed,
    )
    await session.flush()

    await week_notify.notify_employee_timesheet_rejected(
        session,
        employee=employee,
        week_start_date=header.week_start_date,
        week_end_date=_week_end(header),
        comment=trimmed,
    )
    return await _serialize_header(session, header, employee, user=user)


async def lookup_week(
    session: AsyncSession,
    user: dict,
    *,
    employee_id: str | uuid.UUID,
    week_start_raw: str,
) -> dict:
    """Lookup by business employee id (EMP10001) or UUID + week start (Sunday)."""
    reviewer_id = _employee_uuid(user)
    resolved_id = await resolve_timesheet_employee_id(session, employee_id)
    employee = await _assert_can_review_timesheet(
        session,
        user,
        reviewer_id=reviewer_id,
        employee_id=resolved_id,
    )
    week_start = sunday_of_week(parse_iso_date(week_start_raw))

    result = await session.execute(
        select(TimesheetHeader)
        .where(
            TimesheetHeader.employee_id == resolved_id,
            TimesheetHeader.week_start_date == week_start,
        )
        .options(_load_options())
    )
    header = result.scalar_one_or_none()
    if header is None or header.status == TIMESHEET_STATUS_DRAFT:
        raise HTTPException(
            status_code=404,
            detail="No submitted timesheet found for that employee and week",
        )
    return await _serialize_header(session, header, employee, user=user)
