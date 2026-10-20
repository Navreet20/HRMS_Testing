"""Leave approvals: access rules, approve, reject, reject after approval."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.tables import LeaveRequest, LeaveRequestDay
from app.modules.leave_approvals import router as approvals_router
from app.modules.leave_approvals import service as svc

MANAGER_ID = uuid.uuid4()
EMPLOYEE_ID = uuid.uuid4()
MANAGER = {"employeeId": str(MANAGER_ID), "role": "EMPLOYEE"}
HR = {"employeeId": str(uuid.uuid4()), "role": "HR"}
OTHER = {"employeeId": str(uuid.uuid4()), "role": "EMPLOYEE"}
SICK = SimpleNamespace(leave_type_id=uuid.uuid4(), leave_type_name="Sick Leave")


def _employee(manager_id: uuid.UUID | None = MANAGER_ID) -> SimpleNamespace:
    return SimpleNamespace(
        employee_id=EMPLOYEE_ID,
        reporting_manager_id=manager_id,
        first_name="Sam",
        last_name="Lee",
        email_id="sam@example.com",
    )


def _request(status: str = "Pending", *, days: list[date] | None = None, recalled: bool = False) -> LeaveRequest:
    day_list = days or [date(2026, 11, 16), date(2026, 11, 17)]
    request = LeaveRequest(
        leave_request_id=uuid.uuid4(),
        employee_id=EMPLOYEE_ID,
        leave_type_id=SICK.leave_type_id,
        from_date=day_list[0],
        to_date=day_list[-1],
        leave_days=float(len(day_list)),
        status=status,
        submitted_date=datetime(2026, 9, 1, tzinfo=timezone.utc),
        recalled_at=datetime(2026, 9, 2, tzinfo=timezone.utc) if recalled else None,
        rejected_after_approval=False,
    )
    for value in day_list:
        request.days.append(
            LeaveRequestDay(leave_date=value, is_half_day=False, day_value=1.0, leave_year=value.year)
        )
    return request


def _db_returning(row: Any) -> AsyncMock:
    result = MagicMock()
    result.first.return_value = row
    db = AsyncMock()
    db.execute.return_value = result
    return db


# --- who can review ------------------------------------------------------------


async def test_reporting_manager_can_review_direct_report() -> None:
    request = _request()
    loaded = await svc._load_for_review(
        _db_returning((request, _employee(), SICK)), MANAGER, request.leave_request_id
    )
    assert loaded[0] is request


async def test_non_manager_is_denied() -> None:
    request = _request()
    with pytest.raises(HTTPException) as exc:
        await svc._load_for_review(
            _db_returning((request, _employee(), SICK)), OTHER, request.leave_request_id
        )
    assert exc.value.status_code == 403


async def test_hr_can_review_anyone() -> None:
    request = _request()
    loaded = await svc._load_for_review(
        _db_returning((request, _employee(manager_id=None), SICK)), HR, request.leave_request_id
    )
    assert loaded[0] is request


async def test_nobody_reviews_their_own_request() -> None:
    request = _request()
    own = {"employeeId": str(EMPLOYEE_ID), "role": "HR"}
    with pytest.raises(HTTPException) as exc:
        await svc._load_for_review(
            _db_returning((request, _employee(), SICK)), own, request.leave_request_id
        )
    assert exc.value.status_code == 403
    assert exc.value.detail == svc.OWN_REQUEST


async def test_recalled_request_is_blocked() -> None:
    request = _request(recalled=True)
    with pytest.raises(HTTPException) as exc:
        await svc._load_for_review(
            _db_returning((request, _employee(), SICK)), MANAGER, request.leave_request_id
        )
    assert exc.value.status_code == 409
    assert exc.value.detail == svc.RECALLED


async def test_queue_rejects_unknown_status() -> None:
    with pytest.raises(HTTPException) as exc:
        await svc.approval_queue(AsyncMock(), MANAGER, "Rejected")
    assert exc.value.status_code == 400


# --- approve / reject ----------------------------------------------------------


@pytest.fixture
def review_env(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    env: dict[str, Any] = {
        "deduct": AsyncMock(),
        "restore": AsyncMock(),
        "ensure": AsyncMock(),
        "approved_email": AsyncMock(),
        "rejected_email": AsyncMock(),
    }
    monkeypatch.setattr(svc, "_today", lambda: date(2026, 9, 24))
    monkeypatch.setattr(svc, "apply_approval_deduction", env["deduct"])
    monkeypatch.setattr(svc, "_adjust_used_for_days", env["restore"])
    monkeypatch.setattr(svc, "_ensure_balances_for_days", env["ensure"])
    monkeypatch.setattr(svc, "notify_employee_leave_approved", env["approved_email"])
    monkeypatch.setattr(svc, "notify_employee_leave_rejected", env["rejected_email"])
    monkeypatch.setattr(svc, "_queue_row", AsyncMock(side_effect=lambda db, r, e, t: {"status": r.status}))
    return env


def _patch_load(monkeypatch: pytest.MonkeyPatch, request: LeaveRequest) -> None:
    monkeypatch.setattr(svc, "_load_for_review", AsyncMock(return_value=(request, _employee(), SICK)))


async def test_approve_deducts_and_emails(review_env: dict[str, Any], monkeypatch: pytest.MonkeyPatch) -> None:
    request = _request()
    _patch_load(monkeypatch, request)

    result = await svc.approve_request(AsyncMock(), MANAGER, request.leave_request_id)

    assert result == {"status": "Approved"}
    assert request.action_date is not None
    assert request.approver_id == MANAGER_ID
    review_env["ensure"].assert_awaited_once()
    review_env["deduct"].assert_awaited_once()
    review_env["approved_email"].assert_awaited_once()


async def test_approve_requires_pending(review_env: dict[str, Any], monkeypatch: pytest.MonkeyPatch) -> None:
    request = _request("Approved")
    _patch_load(monkeypatch, request)
    with pytest.raises(HTTPException) as exc:
        await svc.approve_request(AsyncMock(), MANAGER, request.leave_request_id)
    assert exc.value.status_code == 409
    review_env["deduct"].assert_not_awaited()


async def test_reject_pending_keeps_balance(review_env: dict[str, Any], monkeypatch: pytest.MonkeyPatch) -> None:
    request = _request()
    _patch_load(monkeypatch, request)

    await svc.reject_request(AsyncMock(), MANAGER, request.leave_request_id, "Team offsite")

    assert request.status == "Rejected"
    assert request.rejection_reason == "Team offsite"
    assert request.rejected_after_approval is False
    review_env["restore"].assert_not_awaited()
    assert review_env["rejected_email"].await_args.kwargs["reason"] == "Team offsite"


async def test_reject_after_approval_restores_current_and_future_days(
    review_env: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    request = _request("Approved", days=[date(2026, 12, 31), date(2027, 1, 4)])
    _patch_load(monkeypatch, request)

    await svc.reject_request(AsyncMock(), MANAGER, request.leave_request_id, "Wrong dates")

    assert request.status == "Rejected"
    assert request.rejected_after_approval is True
    restored = review_env["restore"].await_args.args[2]
    assert [d.leave_year for d in restored] == [2026, 2027]
    assert review_env["rejected_email"].await_args.kwargs["after_approval"] is True


async def test_reject_after_approval_in_closed_year_changes_status_only(
    review_env: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    request = _request("Approved", days=[date(2025, 12, 1)])
    _patch_load(monkeypatch, request)

    await svc.reject_request(AsyncMock(), MANAGER, request.leave_request_id, "Correction")

    assert request.status == "Rejected"
    assert request.rejected_after_approval is True
    review_env["restore"].assert_not_awaited()


async def test_reject_twice_is_blocked(review_env: dict[str, Any], monkeypatch: pytest.MonkeyPatch) -> None:
    request = _request("Rejected")
    _patch_load(monkeypatch, request)
    with pytest.raises(HTTPException) as exc:
        await svc.reject_request(AsyncMock(), MANAGER, request.leave_request_id, "Again")
    assert exc.value.status_code == 409


async def test_next_year_balance_row_is_created_before_deduction(monkeypatch: pytest.MonkeyPatch) -> None:
    ensure = AsyncMock()
    monkeypatch.setattr(svc, "ensure_year_balances", ensure)
    result = MagicMock()
    result.scalar_one_or_none.side_effect = [uuid.uuid4(), None]
    db = AsyncMock()
    db.execute.return_value = result
    request = _request(days=[date(2026, 12, 31), date(2027, 1, 4)])

    await svc._ensure_balances_for_days(db, request)

    ensure.assert_awaited_once_with(db, EMPLOYEE_ID, 2027)


# --- routing -------------------------------------------------------------------


async def test_reject_without_reason_is_rejected_by_api() -> None:
    app = FastAPI()
    app.include_router(approvals_router.router, prefix="/api/v1")

    async def _user() -> dict[str, Any]:
        return MANAGER

    async def _db() -> Any:
        yield AsyncMock()

    app.dependency_overrides[get_current_user] = _user
    app.dependency_overrides[get_db] = _db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            f"/api/v1/leave-approvals/{uuid.uuid4()}/reject", json={"reason": "   "}
        )
    assert response.status_code == 422


# --- the queue's "overlaps another leave" tag is day-level and half-aware -----


def _day(on: date, half: bool = False, part: str | None = None) -> SimpleNamespace:
    return SimpleNamespace(leave_date=on, is_half_day=half, half_part=part, day_value=0.5 if half else 1.0)


def _db_with_other_days(days: list[SimpleNamespace]) -> MagicMock:
    result = MagicMock()
    result.scalars.return_value.all.return_value = days
    db = MagicMock()
    db.execute = AsyncMock(return_value=result)
    return db


async def test_overlap_tag_shows_for_a_shared_full_day() -> None:
    from app.modules.leave_approvals.service import _has_overlap

    day = date(2026, 11, 16)
    request = SimpleNamespace(days=[_day(day)], employee_id="e", leave_request_id="r")
    assert await _has_overlap(_db_with_other_days([_day(day)]), request) is True


async def test_overlap_tag_stays_off_for_first_half_plus_second_half() -> None:
    from app.modules.leave_approvals.service import _has_overlap

    day = date(2026, 11, 16)
    request = SimpleNamespace(days=[_day(day, True, "first")], employee_id="e", leave_request_id="r")
    other = _db_with_other_days([_day(day, True, "second")])
    assert await _has_overlap(other, request) is False
    same_half = _db_with_other_days([_day(day, True, "first")])
    assert await _has_overlap(same_half, request) is True
