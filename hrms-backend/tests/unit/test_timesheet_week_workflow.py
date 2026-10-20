"""Weekly timesheet workflow — TS-DATA-3/4/5/7/13/14/15."""

from __future__ import annotations

from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.modules.timesheet.constants import (
    TIMESHEET_STATUS_APPROVED,
    TIMESHEET_STATUS_DRAFT,
    TIMESHEET_STATUS_REJECTED,
    TIMESHEET_STATUS_SUBMITTED,
)
from app.modules.timesheet.week_service import (
    assert_editable,
    approval_queue,
    approve_week,
    can_org_approve_timesheets,
    get_or_create_week,
    lookup_week,
    recall_week,
    reject_week,
    resolve_timesheet_employee_id,
    submit_week,
)


@pytest.fixture(autouse=True)
def _no_day_markers():
    """Holiday and leave lookups are covered in test_timesheet_day_markers.py."""
    with patch(
        "app.modules.timesheet.week_service.day_markers_for_week",
        new=AsyncMock(return_value=[]),
    ):
        yield


def _user(employee_id) -> dict:
    return {
        "employeeId": str(employee_id),
        "firstName": "Pat",
        "lastName": "Manager",
    }


def _header(
    *,
    owner_id,
    status: str = TIMESHEET_STATUS_DRAFT,
    lines: list | None = None,
    week_start: date | None = None,
) -> MagicMock:
    week_start = week_start or date(2026, 9, 13)
    tid = uuid4()
    header = MagicMock()
    header.id = tid
    header.timesheet_id = tid
    header.employee_id = owner_id
    header.week_start_date = week_start
    header.status = status
    header.submitted_at = None
    header.decided_by_employee_id = None
    header.decided_at = None
    header.rejection_comment = None
    item = MagicMock()
    item.id = uuid4()
    item.category = "Other"
    item.project_id = None
    item.leave_type_id = None
    item.activity_type = None
    item.other_type = "Research"
    item.other_comment = None
    item.billable = False
    item.day_entries = []
    header.items = lines if lines is not None else [item]
    return header


def _employee(*, employee_id, manager_id=None, first="Alex", last="Employee") -> MagicMock:
    emp = MagicMock()
    emp.employee_id = employee_id
    emp.reporting_manager_id = manager_id
    emp.first_name = first
    emp.last_name = last
    return emp


@pytest.mark.asyncio
async def test_submit_draft_to_submitted() -> None:
    owner_id = uuid4()
    header = _header(owner_id=owner_id, status=TIMESHEET_STATUS_DRAFT)
    emp = _employee(employee_id=owner_id, manager_id=uuid4())
    session = AsyncMock()
    session.flush = AsyncMock()

    with (
        patch(
            "app.modules.timesheet.week_service._load_header",
            new=AsyncMock(return_value=header),
        ),
        patch(
            "app.modules.timesheet.week_service._require_employee",
            new=AsyncMock(return_value=emp),
        ),
        patch(
            "app.modules.timesheet.week_service.week_notify.notify_manager_timesheet_submitted",
            new_callable=AsyncMock,
        ) as notify,
    ):
        payload = await submit_week(session, _user(owner_id), header.timesheet_id)

    assert header.status == TIMESHEET_STATUS_SUBMITTED
    assert header.submitted_at is not None
    assert payload["status"] == TIMESHEET_STATUS_SUBMITTED
    notify.assert_awaited_once()


@pytest.mark.asyncio
async def test_submit_rejected_resubmits() -> None:
    owner_id = uuid4()
    header = _header(owner_id=owner_id, status=TIMESHEET_STATUS_REJECTED)
    header.rejection_comment = "Fix hours"
    emp = _employee(employee_id=owner_id, manager_id=uuid4())
    session = AsyncMock()
    session.flush = AsyncMock()

    with (
        patch(
            "app.modules.timesheet.week_service._load_header",
            new=AsyncMock(return_value=header),
        ),
        patch(
            "app.modules.timesheet.week_service._require_employee",
            new=AsyncMock(return_value=emp),
        ),
        patch(
            "app.modules.timesheet.week_service.week_notify.notify_manager_timesheet_submitted",
            new_callable=AsyncMock,
        ),
    ):
        payload = await submit_week(session, _user(owner_id), header.timesheet_id)

    assert header.status == TIMESHEET_STATUS_SUBMITTED
    assert header.rejection_comment is None
    assert payload["status"] == TIMESHEET_STATUS_SUBMITTED


@pytest.mark.asyncio
async def test_submit_rejects_empty_rows() -> None:
    owner_id = uuid4()
    header = _header(owner_id=owner_id, lines=[])
    session = AsyncMock()

    with patch(
        "app.modules.timesheet.week_service._load_header",
        new=AsyncMock(return_value=header),
    ):
        with pytest.raises(HTTPException) as exc:
            await submit_week(session, _user(owner_id), header.timesheet_id)
    assert exc.value.status_code == 400
    assert "no rows" in str(exc.value.detail).lower()


@pytest.mark.asyncio
async def test_submit_rejects_non_draft() -> None:
    owner_id = uuid4()
    header = _header(owner_id=owner_id, status=TIMESHEET_STATUS_SUBMITTED)
    session = AsyncMock()

    with patch(
        "app.modules.timesheet.week_service._load_header",
        new=AsyncMock(return_value=header),
    ):
        with pytest.raises(HTTPException) as exc:
            await submit_week(session, _user(owner_id), header.timesheet_id)
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_recall_submitted_to_draft() -> None:
    owner_id = uuid4()
    header = _header(owner_id=owner_id, status=TIMESHEET_STATUS_SUBMITTED)
    header.submitted_at = date.today()
    emp = _employee(employee_id=owner_id)
    session = AsyncMock()
    session.flush = AsyncMock()

    with (
        patch(
            "app.modules.timesheet.week_service._load_header",
            new=AsyncMock(return_value=header),
        ),
        patch(
            "app.modules.timesheet.week_service._require_employee",
            new=AsyncMock(return_value=emp),
        ),
    ):
        payload = await recall_week(session, _user(owner_id), header.timesheet_id)

    assert header.status == TIMESHEET_STATUS_DRAFT
    assert header.submitted_at is None
    assert payload["status"] == TIMESHEET_STATUS_DRAFT


@pytest.mark.asyncio
async def test_recall_blocked_when_approved() -> None:
    owner_id = uuid4()
    header = _header(owner_id=owner_id, status=TIMESHEET_STATUS_APPROVED)
    session = AsyncMock()

    with patch(
        "app.modules.timesheet.week_service._load_header",
        new=AsyncMock(return_value=header),
    ):
        with pytest.raises(HTTPException) as exc:
            await recall_week(session, _user(owner_id), header.timesheet_id)
    assert exc.value.status_code == 400


def test_assert_editable_blocks_approved_and_submitted() -> None:
    approved = _header(owner_id=uuid4(), status=TIMESHEET_STATUS_APPROVED)
    submitted = _header(owner_id=uuid4(), status=TIMESHEET_STATUS_SUBMITTED)
    with pytest.raises(HTTPException):
        assert_editable(approved)
    with pytest.raises(HTTPException):
        assert_editable(submitted)
    assert_editable(_header(owner_id=uuid4(), status=TIMESHEET_STATUS_DRAFT))
    assert_editable(_header(owner_id=uuid4(), status=TIMESHEET_STATUS_REJECTED))


@pytest.mark.asyncio
async def test_approve_blocks_self_approval() -> None:
    owner_id = uuid4()
    header = _header(owner_id=owner_id, status=TIMESHEET_STATUS_SUBMITTED)
    session = AsyncMock()

    with patch(
        "app.modules.timesheet.week_service._load_header",
        new=AsyncMock(return_value=header),
    ):
        with pytest.raises(HTTPException) as exc:
            await approve_week(session, _user(owner_id), header.timesheet_id)
    assert exc.value.status_code == 403
    assert "own" in str(exc.value.detail).lower()


@pytest.mark.asyncio
async def test_approve_submitted_for_direct_report() -> None:
    manager_id = uuid4()
    owner_id = uuid4()
    header = _header(owner_id=owner_id, status=TIMESHEET_STATUS_SUBMITTED)
    emp = _employee(employee_id=owner_id, manager_id=manager_id)
    session = AsyncMock()
    session.flush = AsyncMock()

    with (
        patch(
            "app.modules.timesheet.week_service._load_header",
            new=AsyncMock(return_value=header),
        ),
        patch(
            "app.modules.timesheet.week_service._assert_can_review_timesheet",
            new=AsyncMock(return_value=emp),
        ),
        patch(
            "app.modules.timesheet.week_service.week_notify.notify_employee_timesheet_approved",
            new_callable=AsyncMock,
        ),
    ):
        payload = await approve_week(session, _user(manager_id), header.timesheet_id)

    assert header.status == TIMESHEET_STATUS_APPROVED
    assert header.decided_by_employee_id == manager_id
    assert payload["status"] == TIMESHEET_STATUS_APPROVED


@pytest.mark.asyncio
async def test_reject_requires_comment() -> None:
    manager_id = uuid4()
    header = _header(owner_id=uuid4(), status=TIMESHEET_STATUS_SUBMITTED)
    session = AsyncMock()

    with pytest.raises(HTTPException) as exc:
        await reject_week(session, _user(manager_id), header.timesheet_id, "   ")
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_reject_approved_clears_decision_and_sets_comment() -> None:
    """New schema has no reopened_from_approved column; API always reports false."""
    manager_id = uuid4()
    owner_id = uuid4()
    header = _header(owner_id=owner_id, status=TIMESHEET_STATUS_APPROVED)
    emp = _employee(employee_id=owner_id, manager_id=manager_id)
    session = AsyncMock()
    session.flush = AsyncMock()

    with (
        patch(
            "app.modules.timesheet.week_service._load_header",
            new=AsyncMock(return_value=header),
        ),
        patch(
            "app.modules.timesheet.week_service._assert_can_review_timesheet",
            new=AsyncMock(return_value=emp),
        ),
        patch(
            "app.modules.timesheet.week_service.week_notify.notify_employee_timesheet_rejected",
            new_callable=AsyncMock,
        ),
    ):
        payload = await reject_week(
            session, _user(manager_id), header.timesheet_id, "Fix Friday hours"
        )

    assert header.status == TIMESHEET_STATUS_REJECTED
    assert header.rejection_comment == "Fix Friday hours"
    assert payload["reopenedFromApproved"] is False


@pytest.mark.asyncio
async def test_lookup_hides_draft() -> None:
    manager_id = uuid4()
    owner_id = uuid4()
    week_start = date(2026, 9, 13)
    header = _header(owner_id=owner_id, status=TIMESHEET_STATUS_DRAFT, week_start=week_start)
    emp = _employee(employee_id=owner_id, manager_id=manager_id)
    session = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = header
    session.execute = AsyncMock(return_value=result)

    with patch(
        "app.modules.timesheet.week_service._assert_can_review_timesheet",
        new=AsyncMock(return_value=emp),
    ):
        with pytest.raises(HTTPException) as exc:
            await lookup_week(
                session,
                _user(manager_id),
                employee_id=owner_id,
                week_start_raw=week_start.isoformat(),
            )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_resolve_employee_id_from_business_code() -> None:
    owner_id = uuid4()
    result = MagicMock()
    result.scalar_one_or_none.return_value = owner_id
    session = AsyncMock()
    session.execute = AsyncMock(return_value=result)
    found = await resolve_timesheet_employee_id(session, "emp10001")
    assert found == owner_id
    session.execute.assert_awaited_once()


@pytest.mark.asyncio
async def test_resolve_employee_id_uuid_skips_table_lookup() -> None:
    owner_id = uuid4()
    session = AsyncMock()
    found = await resolve_timesheet_employee_id(session, owner_id)
    assert found == owner_id
    session.execute.assert_not_called()


@pytest.mark.asyncio
async def test_resolve_unknown_business_id_404() -> None:
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    session = AsyncMock()
    session.execute = AsyncMock(return_value=result)
    with pytest.raises(HTTPException) as exc:
        await resolve_timesheet_employee_id(session, "EMP99999")
    assert exc.value.status_code == 404
    assert "EMP99999" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_lookup_accepts_business_employee_id() -> None:
    manager_id = uuid4()
    owner_id = uuid4()
    week_start = date(2026, 9, 13)
    header = _header(
        owner_id=owner_id,
        status=TIMESHEET_STATUS_SUBMITTED,
        week_start=week_start,
        lines=[],
    )
    emp = _employee(employee_id=owner_id, manager_id=manager_id)
    emp.business_employee_id = "EMP10001"
    session = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = header
    session.execute = AsyncMock(return_value=result)

    with (
        patch(
            "app.modules.timesheet.week_service.resolve_timesheet_employee_id",
            new=AsyncMock(return_value=owner_id),
        ) as resolve,
        patch(
            "app.modules.timesheet.week_service._assert_can_review_timesheet",
            new=AsyncMock(return_value=emp),
        ),
    ):
        payload = await lookup_week(
            session,
            _user(manager_id),
            employee_id="EMP10001",
            week_start_raw=week_start.isoformat(),
        )

    resolve.assert_awaited_once()
    assert payload["businessEmployeeId"] == "EMP10001"
    assert payload["status"] == TIMESHEET_STATUS_SUBMITTED


@pytest.mark.asyncio
async def test_hr_can_approve_employee_who_is_not_a_direct_report() -> None:
    hr_id = uuid4()
    owner_id = uuid4()
    header = _header(owner_id=owner_id, status=TIMESHEET_STATUS_SUBMITTED)
    emp = _employee(employee_id=owner_id, manager_id=None)
    session = AsyncMock()
    session.flush = AsyncMock()
    hr_user = {**_user(hr_id), "role": "HR"}

    with (
        patch(
            "app.modules.timesheet.week_service._load_header",
            new=AsyncMock(return_value=header),
        ),
        patch(
            "app.modules.timesheet.week_service._require_employee",
            new=AsyncMock(return_value=emp),
        ),
        patch(
            "app.modules.timesheet.week_service.week_notify.notify_employee_timesheet_approved",
            new_callable=AsyncMock,
        ),
    ):
        payload = await approve_week(session, hr_user, header.timesheet_id)

    assert header.status == TIMESHEET_STATUS_APPROVED
    assert payload["status"] == TIMESHEET_STATUS_APPROVED


@pytest.mark.asyncio
async def test_plain_employee_cannot_approve_non_report() -> None:
    reviewer_id = uuid4()
    owner_id = uuid4()
    header = _header(owner_id=owner_id, status=TIMESHEET_STATUS_SUBMITTED)
    emp = _employee(employee_id=owner_id, manager_id=None)
    session = AsyncMock()

    with (
        patch(
            "app.modules.timesheet.week_service._load_header",
            new=AsyncMock(return_value=header),
        ),
        patch(
            "app.modules.timesheet.week_service._require_employee",
            new=AsyncMock(return_value=emp),
        ),
    ):
        with pytest.raises(HTTPException) as exc:
            await approve_week(
                session, {**_user(reviewer_id), "role": "EMPLOYEE"}, header.timesheet_id
            )
    assert exc.value.status_code == 403


def test_org_approver_roles_include_hr_admin_and_developer() -> None:
    assert can_org_approve_timesheets({"role": "HR"}) is True
    assert can_org_approve_timesheets({"role": "ADMIN"}) is True
    assert can_org_approve_timesheets({"role": "SUPERADMIN"}) is True
    assert can_org_approve_timesheets({"role": "EMPLOYEE"}) is False
    assert can_org_approve_timesheets({"role": "MANAGER"}) is False


@pytest.mark.asyncio
async def test_get_existing_week_404_when_missing() -> None:
    session = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    session.execute = AsyncMock(return_value=result)
    with pytest.raises(HTTPException) as exc:
        await get_or_create_week(
            session,
            _user(uuid4()),
            "2026-09-13",
            create=False,
        )
    assert exc.value.status_code == 404
    session.add.assert_not_called()


@pytest.mark.asyncio
async def test_approval_queue_rejects_unknown_status_filters() -> None:
    with pytest.raises(HTTPException) as exc:
        await approval_queue(AsyncMock(), {"employeeId": str(uuid4())}, "Draft")
    assert exc.value.status_code == 400


def _save_body(rows: int):
    from app.modules.timesheet.week_schemas import SaveTimesheetWeekBody

    line = {
        "projectCodeCategory": "Other",
        "otherType": "Research",
        "entries": [{"workDate": "2026-09-13", "hours": 1}],
    }
    return SaveTimesheetWeekBody.model_validate({"lines": [line for _ in range(rows)]})


def _draft_header(existing_lines: int, employee_id):
    from types import SimpleNamespace

    tid = uuid4()
    return SimpleNamespace(
        id=tid,
        timesheet_id=tid,
        employee_id=employee_id,
        status="Draft",
        week_start_date=date(2026, 9, 13),
        items=[object() for _ in range(existing_lines)],
    )


@pytest.mark.asyncio
async def test_saving_more_than_seven_new_rows_is_refused() -> None:
    from app.modules.timesheet.week_service import save_draft_week

    user_id = uuid4()
    header = _draft_header(0, user_id)
    with patch(
        "app.modules.timesheet.week_service._load_header", AsyncMock(return_value=header)
    ):
        with pytest.raises(HTTPException) as exc:
            await save_draft_week(AsyncMock(), {"employeeId": str(user_id)}, header.timesheet_id, _save_body(8))
    assert exc.value.status_code == 400
    assert "at most 7 rows" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_a_week_already_over_seven_rows_can_still_be_saved_without_adding_more() -> None:
    from app.modules.timesheet import week_service

    user_id = uuid4()
    header = _draft_header(9, user_id)
    # Past the row-count check it would go on to resolve allocations; stop it there.
    with patch.object(week_service, "_load_header", AsyncMock(return_value=header)), patch.object(
        week_service,
        "_allocated_project_ids_for_employee",
        AsyncMock(side_effect=RuntimeError("past the row check")),
    ):
        with pytest.raises(RuntimeError, match="past the row check"):
            await week_service.save_draft_week(
                AsyncMock(), {"employeeId": str(user_id)}, header.timesheet_id, _save_body(9)
            )
        # ...but adding a 10th is refused.
        with pytest.raises(HTTPException) as exc:
            await week_service.save_draft_week(
                AsyncMock(), {"employeeId": str(user_id)}, header.timesheet_id, _save_body(10)
            )
    assert exc.value.status_code == 400
