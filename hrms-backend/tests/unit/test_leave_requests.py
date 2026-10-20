"""Leave requests: day expansion, validation, submit, recall, resubmit, delete."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.tables import LeaveRequest, LeaveRequestDay
from app.modules.leave_requests import router as leave_router
from app.modules.leave_requests import service as svc
from app.modules.leave_requests.days import (
    build_day_rows,
    days_by_year,
    total_days,
    working_dates,
)
from app.modules.leave_requests.schemas import LeavePreviewBody, LeaveRequestBody

EMPLOYEE_ID = uuid.uuid4()
MANAGER_ID = uuid.uuid4()
SICK_ID = uuid.uuid4()
USER = {"employeeId": str(EMPLOYEE_ID), "role": "EMPLOYEE", "firstName": "Sam", "lastName": "Lee"}
THANKSGIVING_2026 = date(2026, 11, 26)


# --- working-day expansion ---------------------------------------------------


def test_worked_example_skips_weekend_and_thanksgiving() -> None:
    days = working_dates(date(2026, 11, 23), date(2026, 12, 2), [THANKSGIVING_2026])
    assert len(days) == 7
    assert THANKSGIVING_2026 not in days
    assert date(2026, 11, 28) not in days and date(2026, 11, 29) not in days


def test_half_day_on_wednesday_counts_half() -> None:
    dates = working_dates(date(2026, 11, 16), date(2026, 11, 18), [])
    rows = build_day_rows(dates, [date(2026, 11, 18)])
    assert total_days(rows) == Decimal("2.5")
    assert [row.day_value for row in rows] == [Decimal("1.0"), Decimal("1.0"), Decimal("0.5")]


def test_year_crossing_request_splits_days_by_year() -> None:
    rows = build_day_rows(working_dates(date(2026, 12, 28), date(2027, 1, 5), []), [])
    assert days_by_year(rows) == {2026: Decimal("4.0"), 2027: Decimal("3.0")}


def test_weekend_only_range_has_no_working_days() -> None:
    assert working_dates(date(2026, 11, 28), date(2026, 11, 29), []) == []


# --- date validation ---------------------------------------------------------

TODAY = date(2026, 9, 24)


def test_past_date_this_year_is_allowed() -> None:
    svc.validate_dates(date(2026, 2, 2), date(2026, 2, 3), join_date=date(2020, 1, 1), today=TODAY)


@pytest.mark.parametrize(
    ("from_date", "to_date", "join", "detail"),
    [
        (date(2026, 3, 5), date(2026, 3, 4), None, svc.TO_BEFORE_FROM),
        (date(2025, 12, 30), date(2026, 1, 2), None, svc.PREVIOUS_YEAR),
        (date(2026, 3, 2), date(2026, 3, 3), date(2026, 4, 1), svc.BEFORE_JOINING),
    ],
)
def test_invalid_dates_are_rejected(
    from_date: date, to_date: date, join: date | None, detail: str
) -> None:
    with pytest.raises(HTTPException) as exc:
        svc.validate_dates(from_date, to_date, join_date=join, today=TODAY)
    assert exc.value.status_code == 400
    assert exc.value.detail == detail


def test_joined_last_year_can_use_any_date_this_year() -> None:
    svc.validate_dates(date(2026, 1, 5), date(2026, 1, 6), join_date=date(2025, 7, 1), today=TODAY)


def test_shortfall_message_names_available_days() -> None:
    leave_type = SimpleNamespace(leave_type_name="Sick Leave")
    message = svc._shortfall_message(
        leave_type, {2026: Decimal("4")}, {2026: Decimal("2")}
    )
    assert message is not None
    assert "Only 2 days of Sick Leave available in 2026" in message
    assert "Unpaid Leave" in message
    assert svc._shortfall_message(leave_type, {2026: Decimal("2")}, {2026: Decimal("2")}) is None


# --- submit ------------------------------------------------------------------


def _employee() -> SimpleNamespace:
    return SimpleNamespace(
        employee_id=EMPLOYEE_ID,
        reporting_manager_id=MANAGER_ID,
        employment_start_date="2020-01-06",
        leave_policy_id=uuid.uuid4(),
        first_name="Sam",
        last_name="Lee",
    )


def _body(**overrides: Any) -> LeaveRequestBody:
    payload: dict[str, Any] = {
        "leaveTypeId": str(SICK_ID),
        "fromDate": "2026-11-16",
        "toDate": "2026-11-18",
        "halfDays": ["2026-11-18"],
        "reason": "  Flu  ",
    }
    payload.update(overrides)
    return LeaveRequestBody.model_validate(payload)


@pytest.fixture
def submit_env(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    monkeypatch.setattr(svc, "_today", lambda: TODAY)
    monkeypatch.setattr(svc, "_load_employee", AsyncMock(return_value=_employee()))
    monkeypatch.setattr(
        svc,
        "_active_leave_type",
        AsyncMock(return_value=SimpleNamespace(leave_type_id=SICK_ID, leave_type_name="Sick Leave")),
    )
    monkeypatch.setattr(svc, "_holiday_dates", AsyncMock(return_value=[]))
    available = AsyncMock(return_value={2026: Decimal("10")})
    monkeypatch.setattr(svc, "_available_by_year", available)
    monkeypatch.setattr(svc, "_overlapping_requests", AsyncMock(return_value=[]))
    notify = AsyncMock()
    monkeypatch.setattr(svc, "notify_manager_leave_submitted", notify)
    db = AsyncMock()
    db.add = MagicMock()
    return {"db": db, "notify": notify, "available": available}


async def test_submit_creates_pending_request_routed_to_manager(submit_env: dict[str, Any]) -> None:
    created = await svc.submit_request(submit_env["db"], USER, _body())

    request = submit_env["db"].add.call_args_list[0].args[0]
    assert request.status == "Pending"
    assert request.approver_id == MANAGER_ID
    assert request.reason == "Flu"
    assert created["leaveDays"] == 2.5
    assert [d["isHalfDay"] for d in created["days"]] == [False, False, True]
    submit_env["notify"].assert_awaited_once()
    assert submit_env["notify"].await_args.kwargs["manager_id"] == MANAGER_ID


async def test_submit_over_balance_is_blocked_without_split(submit_env: dict[str, Any]) -> None:
    submit_env["available"].return_value = {2026: Decimal("2")}
    with pytest.raises(HTTPException) as exc:
        await svc.submit_request(
            submit_env["db"], USER, _body(fromDate="2026-11-16", toDate="2026-11-19", halfDays=[])
        )
    assert exc.value.status_code == 400
    assert "Only 2 days of Sick Leave available" in exc.value.detail
    submit_env["db"].add.assert_not_called()


async def test_submit_weekend_only_range_is_rejected(submit_env: dict[str, Any]) -> None:
    with pytest.raises(HTTPException) as exc:
        await svc.submit_request(
            submit_env["db"], USER, _body(fromDate="2026-11-28", toDate="2026-11-29", halfDays=[])
        )
    assert exc.value.detail == svc.NO_WORKING_DAYS


async def test_a_request_that_double_books_a_day_is_blocked(
    submit_env: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    overlap = [
        {
            "leaveRequestId": "x",
            "leaveTypeName": "Maternity Leave",
            "status": "Pending",
            "fromDate": "2026-11-16",
            "toDate": "2026-11-18",
            "clashDates": ["2026-11-16", "2026-11-17"],
        }
    ]
    monkeypatch.setattr(svc, "_overlapping_requests", AsyncMock(return_value=overlap))
    preview = await svc.preview_request(
        submit_env["db"], USER, LeavePreviewBody.model_validate(_body().model_dump(by_alias=True))
    )
    assert preview["overlaps"] == overlap
    assert "Maternity Leave (Pending) on Nov 16 to Nov 17 (2 days)" in preview["overlapMessage"]
    with pytest.raises(HTTPException) as exc:
        await svc.submit_request(submit_env["db"], USER, _body())
    assert exc.value.status_code == 400
    assert "Recall it first" in str(exc.value.detail)
    submit_env["db"].add.assert_not_called()


def test_half_days_record_which_half_and_default_to_the_first() -> None:
    dates = working_dates(date(2026, 11, 16), date(2026, 11, 18), [])
    rows = build_day_rows(
        dates, [date(2026, 11, 16)], {date(2026, 11, 18): "second"}
    )
    assert [row.half_part for row in rows] == ["first", None, "second"]
    assert total_days(rows) == Decimal("2.0")


def test_two_leaves_share_a_day_only_when_they_take_different_halves() -> None:
    day = date(2026, 11, 16)
    first = build_day_rows([day], [], {day: "first"})[0]
    second = build_day_rows([day], [], {day: "second"})[0]
    full = build_day_rows([day], [])[0]
    assert svc._halves_clash(first, True, "second") is False
    assert svc._halves_clash(second, True, "first") is False
    assert svc._halves_clash(first, True, "first") is True
    assert svc._halves_clash(first, False, None) is True  # the other one is a full day
    assert svc._halves_clash(full, True, "first") is True  # this one is a full day


def test_overlap_message_is_none_when_nothing_clashes() -> None:
    assert svc.overlap_message([]) is None


async def test_unpaid_has_no_limit(submit_env: dict[str, Any], monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        svc,
        "_active_leave_type",
        AsyncMock(return_value=SimpleNamespace(leave_type_id=SICK_ID, leave_type_name="Unpaid Leave")),
    )
    body = _body(fromDate="2026-11-02", toDate="2026-11-27", halfDays=[])
    preview = await svc.preview_request(
        submit_env["db"], USER, LeavePreviewBody.model_validate(body.model_dump(by_alias=True))
    )
    assert preview["unlimited"] is True
    assert preview["exceedsBalance"] is False
    submit_env["available"].assert_not_awaited()


async def test_submit_without_manager_is_allowed(submit_env: dict[str, Any], monkeypatch: pytest.MonkeyPatch) -> None:
    employee = _employee()
    employee.reporting_manager_id = None
    monkeypatch.setattr(svc, "_load_employee", AsyncMock(return_value=employee))
    await svc.submit_request(submit_env["db"], USER, _body())
    assert submit_env["db"].add.call_args_list[0].args[0].approver_id is None


# --- recall / resubmit / delete ----------------------------------------------


def _request(status: str = "Pending", recalled: bool = False) -> LeaveRequest:
    request = LeaveRequest(
        leave_request_id=uuid.uuid4(),
        employee_id=EMPLOYEE_ID,
        leave_type_id=SICK_ID,
        from_date=date(2026, 11, 16),
        to_date=date(2026, 11, 16),
        leave_days=1.0,
        status=status,
        submitted_date=datetime(2026, 9, 1, tzinfo=timezone.utc),
        recalled_at=datetime(2026, 9, 2, tzinfo=timezone.utc) if recalled else None,
        rejected_after_approval=False,
    )
    request.days.append(
        LeaveRequestDay(leave_date=date(2026, 11, 16), is_half_day=False, day_value=1.0, leave_year=2026)
    )
    return request


def _patch_own(monkeypatch: pytest.MonkeyPatch, request: LeaveRequest) -> None:
    monkeypatch.setattr(svc, "_load_own_request", AsyncMock(return_value=(request, "Sick Leave")))


async def test_recall_pending_request(monkeypatch: pytest.MonkeyPatch) -> None:
    request = _request()
    _patch_own(monkeypatch, request)
    result = await svc.recall_request(AsyncMock(), USER, request.leave_request_id)
    assert request.recalled_at is not None
    assert result["recalled"] is True


@pytest.mark.parametrize("status", ["Approved", "Rejected"])
async def test_recall_is_unavailable_after_decision(monkeypatch: pytest.MonkeyPatch, status: str) -> None:
    request = _request(status)
    _patch_own(monkeypatch, request)
    with pytest.raises(HTTPException) as exc:
        await svc.recall_request(AsyncMock(), USER, request.leave_request_id)
    assert exc.value.status_code == 409


async def test_resubmit_keeps_id_and_returns_to_pending(
    submit_env: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    request = _request(recalled=True)
    original_id = request.leave_request_id
    _patch_own(monkeypatch, request)

    result = await svc.resubmit_request(submit_env["db"], USER, original_id, _body())

    assert result["leaveRequestId"] == str(original_id)
    assert result["status"] == "Pending"
    assert result["recalled"] is False
    assert result["leaveDays"] == 2.5
    assert request.submitted_date > datetime(2026, 9, 1, tzinfo=timezone.utc)
    assert submit_env["notify"].await_args.kwargs["resubmitted"] is True


async def test_resubmit_requires_recall(submit_env: dict[str, Any], monkeypatch: pytest.MonkeyPatch) -> None:
    request = _request()
    _patch_own(monkeypatch, request)
    with pytest.raises(HTTPException) as exc:
        await svc.resubmit_request(submit_env["db"], USER, request.leave_request_id, _body())
    assert exc.value.status_code == 409


def _events(db: Any) -> list[str]:
    from app.models.awaiting import (WorkflowEvent)

    return [
        call.args[0].event
        for call in db.add.call_args_list
        if isinstance(call.args[0], WorkflowEvent)
    ]


async def test_submit_writes_a_submitted_event(submit_env: dict[str, Any]) -> None:
    await svc.submit_request(submit_env["db"], USER, _body())
    assert _events(submit_env["db"]) == ["submitted"]


async def test_rejected_request_reopens_as_recalled_and_keeps_its_history(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    request = _request("Rejected")
    request.rejection_reason = "Wrong dates"
    _patch_own(monkeypatch, request)
    db = AsyncMock()
    db.add = MagicMock()

    result = await svc.reopen_rejected_request(db, USER, request.leave_request_id)

    assert request.status == "Pending"
    assert request.recalled_at is not None
    assert result["recalled"] is True
    assert _events(db) == ["reopened"]


@pytest.mark.parametrize("status", ["Pending", "Approved"])
async def test_only_rejected_requests_can_be_reopened(
    monkeypatch: pytest.MonkeyPatch, status: str
) -> None:
    request = _request(status)
    _patch_own(monkeypatch, request)
    with pytest.raises(HTTPException) as exc:
        await svc.reopen_rejected_request(AsyncMock(), USER, request.leave_request_id)
    assert exc.value.status_code == 409


async def test_resubmitting_a_reopened_request_clears_the_rejection_and_logs_it(
    submit_env: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    request = _request("Pending", recalled=True)
    request.rejection_reason = "Wrong dates"
    request.rejected_after_approval = True
    _patch_own(monkeypatch, request)

    result = await svc.resubmit_request(
        submit_env["db"], USER, request.leave_request_id, _body()
    )

    assert result["rejectionReason"] is None
    assert result["rejectedAfterApproval"] is False
    assert _events(submit_env["db"]) == ["resubmitted"]


async def test_delete_recalled_request(monkeypatch: pytest.MonkeyPatch) -> None:
    request = _request(recalled=True)
    _patch_own(monkeypatch, request)
    db = AsyncMock()
    await svc.delete_recalled_request(db, USER, request.leave_request_id)
    db.delete.assert_awaited_once_with(request)


async def test_delete_requires_recall(monkeypatch: pytest.MonkeyPatch) -> None:
    request = _request()
    _patch_own(monkeypatch, request)
    with pytest.raises(HTTPException) as exc:
        await svc.delete_recalled_request(AsyncMock(), USER, request.leave_request_id)
    assert exc.value.status_code == 409


async def test_history_rejects_unknown_status() -> None:
    with pytest.raises(HTTPException) as exc:
        await svc.list_own_requests(AsyncMock(), USER, status_filter="Withdrawn")
    assert exc.value.status_code == 400


# --- routing -----------------------------------------------------------------


def _app() -> FastAPI:
    app = FastAPI()
    app.include_router(leave_router.router, prefix="/api/v1")

    async def _user() -> dict[str, Any]:
        return USER

    async def _db() -> Any:
        yield AsyncMock()

    app.dependency_overrides[get_current_user] = _user
    app.dependency_overrides[get_db] = _db
    return app


async def test_me_routes_are_not_shadowed_by_request_id(monkeypatch: pytest.MonkeyPatch) -> None:
    listing = AsyncMock(return_value=[])
    balances = AsyncMock(return_value=[])
    monkeypatch.setattr(svc, "list_own_requests", listing)
    monkeypatch.setattr(svc, "list_own_balances", balances)
    transport = ASGITransport(app=_app())
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        history = await client.get("/api/v1/leave-requests/me", params={"status": "Rejected"})
        recalled = await client.get("/api/v1/leave-requests/me/recalled")
        mine = await client.get("/api/v1/leave-requests/me/balances")
    assert history.status_code == recalled.status_code == mine.status_code == 200
    assert listing.await_args_list[0].kwargs == {"status_filter": "Rejected"}
    assert listing.await_args_list[1].kwargs == {"recalled": True}
    balances.assert_awaited_once()


# --- current-year balances on first use (Jan 1 grant fallback) ---------------


async def test_first_use_creates_this_years_balances(monkeypatch: pytest.MonkeyPatch) -> None:
    ensure = AsyncMock(return_value=[])
    monkeypatch.setattr(svc, "ensure_year_balances", ensure)
    monkeypatch.setattr(svc, "_today", lambda: date(2027, 1, 4))
    db = MagicMock()
    employee = SimpleNamespace(employee_id=EMPLOYEE_ID, leave_policy_id=uuid.uuid4())

    await svc._ensure_current_year_balances(db, employee)

    ensure.assert_awaited_once_with(db, EMPLOYEE_ID, 2027)


async def test_no_policy_means_no_balances_are_created(monkeypatch: pytest.MonkeyPatch) -> None:
    ensure = AsyncMock(return_value=[])
    monkeypatch.setattr(svc, "ensure_year_balances", ensure)
    employee = SimpleNamespace(employee_id=EMPLOYEE_ID, leave_policy_id=None)

    await svc._ensure_current_year_balances(MagicMock(), employee)

    ensure.assert_not_awaited()


async def test_pending_days_are_summed_per_leave_type() -> None:
    result = MagicMock()
    result.all.return_value = [(SICK_ID, Decimal("2.5"))]
    db = MagicMock()
    db.execute = AsyncMock(return_value=result)

    pending = await svc._pending_days_by_type(db, EMPLOYEE_ID, 2026)

    assert pending == {SICK_ID: Decimal("2.5")}


# --- safety rules -------------------------------------------------------------


def test_a_request_cannot_span_more_than_366_days_or_start_over_a_year_out() -> None:
    today = date(2026, 9, 29)
    svc.validate_dates(date(2026, 10, 1), date(2027, 9, 30), join_date=None, today=today)  # 365 days
    with pytest.raises(HTTPException) as too_long:
        svc.validate_dates(date(2026, 10, 1), date(2099, 12, 31), join_date=None, today=today)
    assert too_long.value.detail == svc.RANGE_TOO_LONG
    with pytest.raises(HTTPException) as too_far:
        svc.validate_dates(date(2028, 1, 1), date(2028, 1, 2), join_date=None, today=today)
    assert too_far.value.detail == svc.TOO_FAR_AHEAD
