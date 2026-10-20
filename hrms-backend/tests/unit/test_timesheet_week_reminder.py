"""Unit tests for TS-DATA-9 timesheet reminder job."""

from __future__ import annotations

from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.mail.smtp import MailSendError
from app.modules.timesheet import week_reminder
from app.modules.timesheet.constants import (
    TIMESHEET_STATUS_APPROVED,
    TIMESHEET_STATUS_DRAFT,
    TIMESHEET_STATUS_REJECTED,
    TIMESHEET_STATUS_SUBMITTED,
)


def _settings(*, enabled: bool = True) -> SimpleNamespace:
    return SimpleNamespace(
        smtp_enabled=enabled,
        app_public_url="http://localhost:3001",
    )


def _employee(
    *,
    timesheet_required: bool = True,
    employment_start: str = "2026-09-01",
    email: str = "alex@example.com",
) -> MagicMock:
    emp = MagicMock()
    emp.employee_id = uuid4()
    emp.timesheet_required = timesheet_required
    emp.is_system_account = False
    emp.employment_start_date = employment_start
    emp.email_id = email
    emp.first_name = "Alex"
    emp.last_name = "Employee"
    return emp


def test_prior_week_sundays_excludes_current_week() -> None:
    # Tuesday 2026-09-15 → current Sunday 2026-09-13; prior Sunday 2026-09-06
    weeks = week_reminder._prior_week_sundays(
        start_day=date(2026, 9, 1),
        today=date(2026, 9, 15),
    )
    assert weeks == [date(2026, 8, 30), date(2026, 9, 6)]


def test_prior_week_sundays_empty_when_started_this_week() -> None:
    weeks = week_reminder._prior_week_sundays(
        start_day=date(2026, 9, 14),
        today=date(2026, 9, 15),
    )
    assert weeks == []


@pytest.mark.asyncio
async def test_find_outstanding_excludes_submitted_and_approved() -> None:
    emp = _employee(employment_start="2026-09-01")
    # Prior weeks for Tuesday 2026-09-15: 2026-08-30, 2026-09-06
    rows = [
        (date(2026, 8, 30), TIMESHEET_STATUS_SUBMITTED),
        (date(2026, 9, 6), TIMESHEET_STATUS_DRAFT),
    ]
    session = AsyncMock()
    result = MagicMock()
    result.all.return_value = rows
    session.execute = AsyncMock(return_value=result)

    outstanding = await week_reminder.find_outstanding_prior_weeks(
        session, employee=emp, today=date(2026, 9, 15)
    )
    assert outstanding == [date(2026, 9, 6)]


@pytest.mark.asyncio
async def test_find_outstanding_includes_missing_and_rejected() -> None:
    emp = _employee(employment_start="2026-09-01")
    rows = [
        (date(2026, 9, 6), TIMESHEET_STATUS_REJECTED),
        # 2026-08-30 missing entirely
    ]
    session = AsyncMock()
    result = MagicMock()
    result.all.return_value = rows
    session.execute = AsyncMock(return_value=result)

    outstanding = await week_reminder.find_outstanding_prior_weeks(
        session, employee=emp, today=date(2026, 9, 15)
    )
    assert outstanding == [date(2026, 8, 30), date(2026, 9, 6)]


@pytest.mark.asyncio
async def test_run_skips_non_reminder_day_unless_forced(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Wednesday, default reminder Tuesday
    session = AsyncMock()
    monkeypatch.setattr(
        week_reminder,
        "resolve_reminder_weekday",
        AsyncMock(return_value=1),
    )
    monkeypatch.setattr(
        week_reminder,
        "notify_managers_of_unreviewed",
        AsyncMock(
            return_value={
                "emailed": 0,
                "failedOrSkippedSend": 0,
                "managers": [],
            }
        ),
    )
    result = await week_reminder.run_timesheet_reminders(
        session, today=date(2026, 9, 16), force=False
    )
    assert result["skipped"] is True
    assert result["reason"] == "not_reminder_day"
    session.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_run_emails_required_employees_on_tuesday(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    required = _employee(timesheet_required=True, email="need@example.com")

    emp_result = MagicMock()
    # DB query already filters timesheet_required=true
    emp_result.scalars.return_value.all.return_value = [required]

    header_result = MagicMock()
    # One outstanding Draft week; Aug 30 approved → not outstanding
    header_result.all.return_value = [
        (date(2026, 9, 6), TIMESHEET_STATUS_DRAFT),
        (date(2026, 8, 30), TIMESHEET_STATUS_APPROVED),
    ]

    session = AsyncMock()
    session.execute = AsyncMock(side_effect=[emp_result, header_result])

    send = AsyncMock()
    monkeypatch.setattr(week_reminder, "get_settings", lambda: _settings())
    monkeypatch.setattr(week_reminder, "send_email", send)
    monkeypatch.setattr(
        week_reminder,
        "resolve_reminder_weekday",
        AsyncMock(return_value=1),
    )
    monkeypatch.setattr(
        week_reminder,
        "notify_managers_of_unreviewed",
        AsyncMock(
            return_value={
                "emailed": 0,
                "failedOrSkippedSend": 0,
                "managers": [],
            }
        ),
    )

    result = await week_reminder.run_timesheet_reminders(
        session, today=date(2026, 9, 15), force=False
    )

    assert result["skipped"] is False
    assert result["emailed"] == 1
    assert result["candidates"] == 1
    send.assert_awaited_once()
    assert send.await_args.kwargs["to_email"] == "need@example.com"
    assert "2026-09-06" in send.await_args.kwargs["text_body"]
    body = send.await_args.kwargs["text_body"]
    html = send.await_args.kwargs["html_body"]
    assert "http://localhost:3001/employee-portal" in body
    assert "http://localhost:3001/employee-portal/manage" not in body
    assert "http://localhost:3001/employee-portal" in html
    assert "/timesheets" not in body


@pytest.mark.asyncio
async def test_run_soft_fails_mail_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    emp = _employee()
    emp_result = MagicMock()
    emp_result.scalars.return_value.all.return_value = [emp]
    header_result = MagicMock()
    header_result.all.return_value = [(date(2026, 9, 6), TIMESHEET_STATUS_DRAFT)]

    session = AsyncMock()
    session.execute = AsyncMock(
        side_effect=[emp_result, header_result]
    )
    monkeypatch.setattr(week_reminder, "get_settings", lambda: _settings())
    monkeypatch.setattr(
        week_reminder,
        "resolve_reminder_weekday",
        AsyncMock(return_value=1),
    )
    monkeypatch.setattr(
        week_reminder,
        "notify_managers_of_unreviewed",
        AsyncMock(
            return_value={
                "emailed": 0,
                "failedOrSkippedSend": 0,
                "managers": [],
            }
        ),
    )
    monkeypatch.setattr(
        week_reminder,
        "send_email",
        AsyncMock(side_effect=MailSendError("down")),
    )

    result = await week_reminder.run_timesheet_reminders(
        session, today=date(2026, 9, 15), force=True
    )
    assert result["emailed"] == 0
    assert result["failedOrSkippedSend"] == 1
