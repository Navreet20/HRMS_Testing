"""Unit tests for timesheet week_notify (submit / approve / reject emails)."""

from __future__ import annotations

from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.mail.smtp import MailSendError
from app.modules.timesheet import week_notify


def _settings(*, enabled: bool = True) -> SimpleNamespace:
    return SimpleNamespace(
        smtp_enabled=enabled,
        app_public_url="http://localhost:3001",
    )


def _employee(
    *,
    email: str = "alex@example.com",
    first: str = "Alex",
    last: str = "Employee",
    code: str = "E-1",
) -> MagicMock:
    emp = MagicMock()
    emp.employee_id = uuid4()
    emp.email_id = email
    emp.first_name = first
    emp.last_name = last
    emp.business_employee_id = code
    emp.employee_code = code
    return emp


@pytest.mark.asyncio
async def test_submit_notifies_manager(monkeypatch: pytest.MonkeyPatch) -> None:
    employee = _employee()
    manager_id = uuid4()
    manager = _employee(email="mgr@example.com", first="Pat", last="Manager", code="M-1")
    manager.employee_id = manager_id
    session = AsyncMock()
    session.get = AsyncMock(return_value=manager)
    send = AsyncMock()
    monkeypatch.setattr(week_notify, "get_settings", lambda: _settings())
    monkeypatch.setattr(week_notify, "send_email", send)

    await week_notify.notify_manager_timesheet_submitted(
        session,
        employee=employee,
        manager_id=manager_id,
        week_start_date=date(2026, 9, 13),
        week_end_date=date(2026, 9, 19),
    )

    send.assert_awaited_once()
    kwargs = send.await_args.kwargs
    assert kwargs["to_email"] == "mgr@example.com"
    assert "submitted" in kwargs["subject"].lower()
    assert "Alex" in kwargs["text_body"]
    assert "2026-09-13" in kwargs["text_body"]
    assert "http://localhost:3001/employee-portal/manage" in kwargs["text_body"]
    assert "http://localhost:3001/employee-portal/manage" in kwargs["html_body"]
    assert "/timesheets" not in kwargs["text_body"]


@pytest.mark.asyncio
async def test_submit_skips_when_no_manager(monkeypatch: pytest.MonkeyPatch) -> None:
    send = AsyncMock()
    monkeypatch.setattr(week_notify, "get_settings", lambda: _settings())
    monkeypatch.setattr(week_notify, "send_email", send)

    await week_notify.notify_manager_timesheet_submitted(
        AsyncMock(),
        employee=_employee(),
        manager_id=None,
        week_start_date=date(2026, 9, 13),
        week_end_date=date(2026, 9, 19),
    )
    send.assert_not_awaited()


@pytest.mark.asyncio
async def test_submit_soft_fails_on_mail_error(monkeypatch: pytest.MonkeyPatch) -> None:
    manager_id = uuid4()
    manager = _employee(email="mgr@example.com")
    manager.employee_id = manager_id
    session = AsyncMock()
    session.get = AsyncMock(return_value=manager)
    monkeypatch.setattr(week_notify, "get_settings", lambda: _settings())
    monkeypatch.setattr(
        week_notify,
        "send_email",
        AsyncMock(side_effect=MailSendError("boom")),
    )

    # Must not raise — soft-fail.
    await week_notify.notify_manager_timesheet_submitted(
        session,
        employee=_employee(),
        manager_id=manager_id,
        week_start_date=date(2026, 9, 13),
        week_end_date=date(2026, 9, 19),
    )


@pytest.mark.asyncio
async def test_approve_notifies_employee(monkeypatch: pytest.MonkeyPatch) -> None:
    send = AsyncMock()
    monkeypatch.setattr(week_notify, "get_settings", lambda: _settings())
    monkeypatch.setattr(week_notify, "send_email", send)
    emp = _employee()

    await week_notify.notify_employee_timesheet_approved(
        AsyncMock(),
        employee=emp,
        week_start_date=date(2026, 9, 13),
        week_end_date=date(2026, 9, 19),
    )

    send.assert_awaited_once()
    assert send.await_args.kwargs["to_email"] == "alex@example.com"
    assert "approved" in send.await_args.kwargs["subject"].lower()
    body = send.await_args.kwargs["text_body"]
    html = send.await_args.kwargs["html_body"]
    assert "http://localhost:3001/employee-portal" in body
    assert "http://localhost:3001/employee-portal/manage" not in body
    assert "http://localhost:3001/employee-portal" in html
    assert "/timesheets" not in body


@pytest.mark.asyncio
async def test_reject_includes_comment(monkeypatch: pytest.MonkeyPatch) -> None:
    send = AsyncMock()
    monkeypatch.setattr(week_notify, "get_settings", lambda: _settings())
    monkeypatch.setattr(week_notify, "send_email", send)

    await week_notify.notify_employee_timesheet_rejected(
        AsyncMock(),
        employee=_employee(),
        week_start_date=date(2026, 9, 13),
        week_end_date=date(2026, 9, 19),
        comment="Fix hours",
    )

    body = send.await_args.kwargs["text_body"]
    assert "Fix hours" in body
    assert "rejected" in send.await_args.kwargs["subject"].lower()
    assert "http://localhost:3001/employee-portal" in body
    assert "http://localhost:3001/employee-portal/manage" not in body
    assert "/timesheets" not in body


@pytest.mark.asyncio
async def test_skips_when_smtp_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    send = AsyncMock()
    monkeypatch.setattr(week_notify, "get_settings", lambda: _settings(enabled=False))
    monkeypatch.setattr(week_notify, "send_email", send)

    await week_notify.notify_employee_timesheet_approved(
        AsyncMock(),
        employee=_employee(),
        week_start_date=date(2026, 9, 13),
        week_end_date=date(2026, 9, 19),
    )
    send.assert_not_awaited()
