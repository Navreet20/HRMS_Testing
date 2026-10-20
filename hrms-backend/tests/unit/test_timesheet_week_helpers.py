"""Unit tests for Option A week helpers (no DB)."""

from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.modules.timesheet.constants import (
    ACTIVITY_TYPES,
    HOURS_MAX_PER_DAY,
    OTHER_TYPES,
    PROJECT_CODE_CATEGORIES,
    TIMESHEET_LEAVE_TYPES,
)
from app.modules.timesheet.week_schemas import TimesheetLineInput
from app.modules.timesheet.week_service import (
    get_project_code_options,
    sunday_of_week,
    _internal_project_options,
    _validate_entry_work_dates_and_day_caps,
    _validate_line_skeleton,
)


def test_sunday_of_week_when_already_sunday() -> None:
    # 2026-09-13 is a Sunday
    assert sunday_of_week(date(2026, 9, 13)) == date(2026, 9, 13)


def test_sunday_of_week_snaps_midweek_back() -> None:
    # 2026-09-16 is a Wednesday → week starts 2026-09-13
    assert sunday_of_week(date(2026, 9, 16)) == date(2026, 9, 13)


def test_sunday_of_week_saturday() -> None:
    # 2026-09-19 is a Saturday → still week of 2026-09-13
    assert sunday_of_week(date(2026, 9, 19)) == date(2026, 9, 13)


def test_option_a_cascade_constants_cover_ts_data_11() -> None:
    assert "Allocated Projects" in PROJECT_CODE_CATEGORIES
    assert "Internal Project Codes" in PROJECT_CODE_CATEGORIES
    assert "On Leave" in PROJECT_CODE_CATEGORIES
    assert "Other" in PROJECT_CODE_CATEGORIES
    assert "Research" in OTHER_TYPES
    assert "Other" in OTHER_TYPES


def test_activity_and_leave_catalogs_match_product_lists() -> None:
    assert "Development" in ACTIVITY_TYPES
    assert "Testing" in ACTIVITY_TYPES
    assert "Documentation" in ACTIVITY_TYPES
    assert "Personal Leave" in TIMESHEET_LEAVE_TYPES
    assert "Sick Leave" in TIMESHEET_LEAVE_TYPES
    assert "Unpaid Leave" in TIMESHEET_LEAVE_TYPES
    assert "CASUAL" not in TIMESHEET_LEAVE_TYPES
    assert "FMLA" not in TIMESHEET_LEAVE_TYPES


def test_day_cap_constant() -> None:
    assert HOURS_MAX_PER_DAY == Decimal("24.00")


def test_day_cap_rejects_over_24_across_lines() -> None:
    week_start = date(2026, 9, 13)
    week_end = date(2026, 9, 19)
    lines = [
        TimesheetLineInput.model_validate(
            {
                "projectCodeCategory": "On Leave",
                "leaveType": "Personal Leave",
                "entries": [{"workDate": "2026-09-14", "hours": 16}],
            }
        ),
        TimesheetLineInput.model_validate(
            {
                "projectCodeCategory": "On Leave",
                "leaveType": "Medical Leave",
                "entries": [{"workDate": "2026-09-14", "hours": 9}],
            }
        ),
    ]
    with pytest.raises(HTTPException) as exc:
        _validate_entry_work_dates_and_day_caps(lines, week_start, week_end)
    assert "24" in str(exc.value.detail)


def test_day_cap_allows_exactly_24() -> None:
    week_start = date(2026, 9, 13)
    week_end = date(2026, 9, 19)
    lines = [
        TimesheetLineInput.model_validate(
            {
                "projectCodeCategory": "On Leave",
                "leaveType": "Personal Leave",
                "entries": [{"workDate": "2026-09-14", "hours": 24}],
            }
        )
    ]
    _validate_entry_work_dates_and_day_caps(lines, week_start, week_end)


def _leave_line(leave_type: str) -> TimesheetLineInput:
    return TimesheetLineInput.model_validate(
        {
            "projectCodeCategory": "On Leave",
            "leaveType": leave_type,
            "entries": [{"workDate": "2026-09-14", "hours": 8}],
        }
    )


def _internal_line(project_code: str) -> TimesheetLineInput:
    return TimesheetLineInput.model_validate(
        {
            "projectCodeCategory": "Internal Project Codes",
            "projectCode": project_code,
            "activityType": "Development",
            "entries": [{"workDate": "2026-09-14", "hours": 8}],
        }
    )


def test_leave_skeleton_uses_leave_module_codes() -> None:
    _validate_line_skeleton(
        _leave_line("Personal Leave"),
        allocated_codes=set(),
        internal_codes=set(),
    )
    with pytest.raises(HTTPException, match="Unknown leaveType"):
        _validate_line_skeleton(
            _leave_line("FMLA"),
            allocated_codes=set(),
            internal_codes=set(),
        )


def test_internal_skeleton_uses_live_codes_not_fake_stubs() -> None:
    _validate_line_skeleton(
        _internal_line("INTADMIN"),
        allocated_codes=set(),
        internal_codes={"INTADMIN"},
    )
    with pytest.raises(HTTPException, match="Unknown internal project code"):
        _validate_line_skeleton(
            _internal_line("INT-ADMIN"),
            allocated_codes=set(),
            internal_codes=set(),
        )


@pytest.mark.asyncio
async def test_internal_options_come_from_internal_client_projects() -> None:
    project = MagicMock()
    project.project_code = "INTADMIN"
    project.project_number = "PRJ9"
    project.name = "Administration"
    project.id = uuid4()
    project.status = "ACTIVE"

    result = MagicMock()
    result.scalars.return_value.unique.return_value.all.return_value = [project]
    session = AsyncMock()
    session.execute = AsyncMock(return_value=result)

    options = await _internal_project_options(session)
    assert options == [
        {
            "code": "INTADMIN",
            "label": "Administration",
            "projectId": str(project.id),
            "source": "internal_project",
        }
    ]


@pytest.mark.asyncio
async def test_internal_options_skip_inactive_projects() -> None:
    project = MagicMock()
    project.project_code = "OLDINT"
    project.project_number = "PRJ1008"
    project.name = "Retired Internal"
    project.id = uuid4()
    project.status = "INACTIVE"
    project.project_type = "Internal"

    result = MagicMock()
    result.scalars.return_value.unique.return_value.all.return_value = [project]
    session = AsyncMock()
    session.execute = AsyncMock(return_value=result)

    assert await _internal_project_options(session) == []


def _project(code: str, name: str) -> MagicMock:
    project = MagicMock()
    project.project_code = code
    project.project_number = f"PRJ{code[-4:]}"
    project.name = name
    project.id = uuid4()
    project.status = "ACTIVE"
    project.project_type = None
    return project


def _client(name: str, category: str) -> MagicMock:
    client = MagicMock()
    client.client_name = name
    client.client_category = category.upper()
    return client


@pytest.mark.asyncio
async def test_allocated_projects_cover_internal_direct_and_intermediary_clients() -> None:
    """Allocations are not filtered by client category; only the internal list is."""
    internal = _project("HRADMIN", "HR Admin")
    direct = _project("WMTPOS", "Walmart POS")
    intermediary = _project("JNJRX", "J&J Rx Portal")

    alloc_result = MagicMock()
    alloc_result.all.return_value = [
        (MagicMock(), internal, _client("Cognivance", "INTERNAL")),
        (MagicMock(), direct, _client("Walmart", "DIRECT")),
        (MagicMock(), intermediary, _client("Apex Staffing", "INTERMEDIARY")),
    ]
    internal_result = MagicMock()
    internal_result.scalars.return_value.unique.return_value.all.return_value = [internal]
    leave_result = MagicMock()
    leave_result.scalars.return_value.all.return_value = ["Personal Leave"]

    session = AsyncMock()
    session.execute = AsyncMock(
        side_effect=[alloc_result, internal_result, leave_result]
    )

    options = await get_project_code_options(session, {"employeeId": str(uuid4())})

    assert [row["code"] for row in options["allocatedProjects"]] == [
        "HRADMIN",
        "WMTPOS",
        "JNJRX",
    ]
    assert [
        (row["clientName"], row["clientCategory"]) for row in options["allocatedProjects"]
    ] == [
        ("Cognivance", "internal"),
        ("Walmart", "direct"),
        ("Apex Staffing", "intermediary"),
    ]
    assert [row["code"] for row in options["internalProjectCodes"]] == ["HRADMIN"]
