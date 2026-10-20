"""Company holidays: validation, access rules, and mid-year request recalculation."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.tables import LeaveRequest, LeaveRequestDay
from app.modules.holidays import router as holidays_router
from app.modules.holidays import service as svc
from app.modules.holidays.schemas import HolidayBody

THIS_YEAR = date.today().year
COMPANY_ID = uuid.uuid4()

HR_USER = {"employeeId": str(uuid.uuid4()), "role": "HR", "firstName": "Pat", "lastName": "HR"}
EMPLOYEE_USER = {"employeeId": str(uuid.uuid4()), "role": "EMPLOYEE", "firstName": "Sam", "lastName": "Lee"}


@pytest.fixture(autouse=True)
def _no_session_grants(monkeypatch: pytest.MonkeyPatch) -> None:
    # No Leave Policy grant → the route falls back to LEAVE_ADMIN_ROLES.
    monkeypatch.setattr(
        "app.modules.rbac.access.resolve_session_grants",
        AsyncMock(return_value=[]),
    )


def _body(**overrides: Any) -> HolidayBody:
    payload = {
        "holidayYear": THIS_YEAR,
        "holidayName": "Thanksgiving",
        "holidayType": "Federal Holiday",
        "holidayDate": f"{THIS_YEAR}-11-26",
    }
    payload.update(overrides)
    return HolidayBody.model_validate(payload)


def _scalar_result(value: Any) -> MagicMock:
    result = MagicMock()
    result.scalar_one_or_none.return_value = value
    return result


def _build_app(user: dict[str, Any], db: Any) -> FastAPI:
    app = FastAPI()
    app.include_router(holidays_router.router, prefix="/api/v1")

    async def _user() -> dict[str, Any]:
        return user

    async def _db() -> Any:
        yield db

    app.dependency_overrides[get_current_user] = _user
    app.dependency_overrides[get_db] = _db
    return app


async def _client(user: dict[str, Any], db: Any = None) -> AsyncClient:
    transport = ASGITransport(app=_build_app(user, db or AsyncMock()))
    return AsyncClient(transport=transport, base_url="http://test")


def test_day_of_week_is_derived_from_date() -> None:
    assert svc.day_of_week_for(date(2026, 7, 3)) == "Friday"
    assert svc.day_of_week_for(date(2026, 11, 26)) == "Thursday"


def test_holiday_type_must_be_a_listed_type() -> None:
    assert _body(holidayType="Company Holiday").holiday_type == "Company Holiday"
    with pytest.raises(ValidationError):
        _body(holidayType="Made up type")


def test_blank_name_or_type_is_rejected() -> None:
    with pytest.raises(ValidationError):
        _body(holidayName="   ")
    with pytest.raises(ValidationError):
        _body(holidayType="")


def test_year_must_be_current_or_next() -> None:
    today = date(2026, 11, 1)
    svc._validate_body(_body(holidayYear=2026, holidayDate="2026-11-26"), today=today)
    svc._validate_body(_body(holidayYear=2027, holidayDate="2027-01-01"), today=today)
    with pytest.raises(HTTPException) as exc:
        svc._validate_body(_body(holidayYear=2028, holidayDate="2028-01-01"), today=today)
    assert exc.value.status_code == 400
    assert exc.value.detail == svc.HOLIDAY_YEAR_NOT_ALLOWED


def test_date_outside_holiday_year_is_rejected() -> None:
    with pytest.raises(HTTPException) as exc:
        svc._validate_body(
            _body(holidayYear=2026, holidayDate="2027-01-01"), today=date(2026, 11, 1)
        )
    assert exc.value.status_code == 400
    assert exc.value.detail == svc.HOLIDAY_DATE_OUTSIDE_YEAR


async def test_duplicate_date_returns_conflict(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(svc, "resolve_org_master_company_id", AsyncMock(return_value=COMPANY_ID))
    db = AsyncMock()
    db.execute.return_value = _scalar_result(uuid.uuid4())
    with pytest.raises(HTTPException) as exc:
        await svc.create_holiday(db, HR_USER, _body())
    assert exc.value.status_code == 409
    db.add.assert_not_called()


async def test_create_sets_day_of_week_and_recalculates(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(svc, "resolve_org_master_company_id", AsyncMock(return_value=COMPANY_ID))
    recalc = AsyncMock(return_value=0)
    monkeypatch.setattr(svc, "recalculate_requests_for_holiday", recalc)
    db = AsyncMock()
    db.add = MagicMock()
    db.execute.return_value = _scalar_result(None)

    created = await svc.create_holiday(db, HR_USER, _body())

    assert created["dayOfWeek"] == "Thursday"
    assert created["holidayName"] == "Thanksgiving"
    recalc.assert_awaited_once_with(db, date(THIS_YEAR, 11, 26))


def _request_nov_25_to_27(status: str) -> LeaveRequest:
    request = LeaveRequest(
        leave_request_id=uuid.uuid4(),
        employee_id=uuid.uuid4(),
        leave_type_id=uuid.uuid4(),
        from_date=date(2026, 11, 25),
        to_date=date(2026, 11, 27),
        leave_days=3.0,
        status=status,
        submitted_date=datetime.now(timezone.utc),
    )
    for day in (25, 26, 27):
        request.days.append(
            LeaveRequestDay(
                leave_date=date(2026, 11, day),
                is_half_day=False,
                day_value=1.0,
                leave_year=2026,
            )
        )
    return request


def _db_returning_requests(requests: list[LeaveRequest]) -> AsyncMock:
    result = MagicMock()
    result.scalars.return_value.unique.return_value.all.return_value = requests
    db = AsyncMock()
    db.execute.return_value = result
    return db


async def test_mid_year_holiday_recalculates_approved_request(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    adjust = AsyncMock()
    monkeypatch.setattr(svc, "_adjust_used_for_days", adjust)
    request = _request_nov_25_to_27("Approved")

    count = await svc.recalculate_requests_for_holiday(
        _db_returning_requests([request]), date(2026, 11, 27)
    )

    assert count == 1
    assert request.leave_days == 2.0
    assert [d.leave_date.day for d in request.days] == [25, 26]
    adjust.assert_awaited_once()
    restored_days = adjust.await_args.args[2]
    assert [d.leave_date for d in restored_days] == [date(2026, 11, 27)]
    assert adjust.await_args.kwargs == {"restore": True}


async def test_mid_year_holiday_pending_request_has_no_balance_change(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    adjust = AsyncMock()
    monkeypatch.setattr(svc, "_adjust_used_for_days", adjust)
    request = _request_nov_25_to_27("Pending")

    await svc.recalculate_requests_for_holiday(
        _db_returning_requests([request]), date(2026, 11, 27)
    )

    assert request.leave_days == 2.0
    adjust.assert_not_awaited()


async def test_employee_cannot_create_or_edit_holiday() -> None:
    payload = {
        "holidayYear": THIS_YEAR,
        "holidayName": "Labor Day",
        "holidayType": "Federal Holiday",
        "holidayDate": f"{THIS_YEAR}-09-07",
    }
    async with await _client(EMPLOYEE_USER) as ac:
        created = await ac.post("/api/v1/holidays", json=payload)
        edited = await ac.put(f"/api/v1/holidays/{uuid.uuid4()}", json=payload)
    assert created.status_code == 403
    assert edited.status_code == 403


async def test_employee_cannot_view_next_year() -> None:
    async with await _client(EMPLOYEE_USER) as ac:
        response = await ac.get("/api/v1/holidays", params={"year": THIS_YEAR + 1})
    assert response.status_code == 403


async def test_hr_can_view_next_year(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(svc, "resolve_org_master_company_id", AsyncMock(return_value=COMPANY_ID))
    result = MagicMock()
    result.scalars.return_value.all.return_value = []
    db = AsyncMock()
    db.execute.return_value = result
    async with await _client(HR_USER, db) as ac:
        response = await ac.get("/api/v1/holidays", params={"year": THIS_YEAR + 1})
    assert response.status_code == 200
    assert response.json() == []


def _holiday_row(on: date) -> MagicMock:
    row = MagicMock()
    row.holiday_id = uuid.uuid4()
    row.holiday_date = on
    return row


async def test_deleting_a_holiday_puts_the_day_back_into_approved_leave(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    adjust = AsyncMock()
    monkeypatch.setattr(svc, "_adjust_used_for_days", adjust)
    request = _request_nov_25_to_27("Approved")
    request.days[:] = [d for d in request.days if d.leave_date.day != 27]  # the holiday removed it
    request.leave_days = 2.0

    count = await svc.restore_requests_for_deleted_holiday(
        _db_returning_requests([request]), date(2026, 11, 27)
    )

    assert count == 1
    assert request.leave_days == 3.0
    assert sorted(d.leave_date.day for d in request.days) == [25, 26, 27]
    assert adjust.await_args.kwargs == {"restore": False}


async def test_deleting_a_holiday_skips_requests_that_already_have_the_day(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    adjust = AsyncMock()
    monkeypatch.setattr(svc, "_adjust_used_for_days", adjust)
    request = _request_nov_25_to_27("Pending")
    count = await svc.restore_requests_for_deleted_holiday(
        _db_returning_requests([request]), date(2026, 11, 27)
    )
    assert count == 0
    assert request.leave_days == 3.0
    adjust.assert_not_awaited()


async def test_deleting_a_weekend_holiday_changes_no_leave() -> None:
    db = AsyncMock()
    assert await svc.restore_requests_for_deleted_holiday(db, date(2026, 11, 28)) == 0
    db.execute.assert_not_called()


async def test_past_holiday_cannot_be_deleted(monkeypatch: pytest.MonkeyPatch) -> None:
    past = _holiday_row(date(2000, 1, 3))
    monkeypatch.setattr(svc, "_holiday_in_company", AsyncMock(return_value=past))
    with pytest.raises(HTTPException) as exc:
        await svc.delete_holiday(AsyncMock(), HR_USER, past.holiday_id)
    assert exc.value.status_code == 400


async def test_future_holiday_is_deleted(monkeypatch: pytest.MonkeyPatch) -> None:
    future = _holiday_row(date(THIS_YEAR + 1, 1, 5))
    monkeypatch.setattr(svc, "_holiday_in_company", AsyncMock(return_value=future))
    monkeypatch.setattr(svc, "restore_requests_for_deleted_holiday", AsyncMock(return_value=2))
    db = AsyncMock()
    out = await svc.delete_holiday(db, HR_USER, future.holiday_id)
    db.delete.assert_awaited_once_with(future)
    assert out["leaveRequestsUpdated"] == 2


async def test_employee_cannot_delete_holiday() -> None:
    async with await _client(EMPLOYEE_USER) as ac:
        response = await ac.delete(f"/api/v1/holidays/{uuid.uuid4()}")
    assert response.status_code == 403
