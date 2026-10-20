"""Employee invite sends SMTP mail; failures do not keep Invited state."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.core.roles import Status
from app.mail.invite import issue_and_send_invite, mark_invite_accepted
from app.mail.smtp import MailSendError
from app.modules.employee.service import EmployeeService
from app.modules.onboarding.enums import OnboardingStatus


def _session() -> AsyncMock:
    session = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.rollback = AsyncMock()
    empty = MagicMock()
    empty.scalar_one_or_none.return_value = None
    session.execute = AsyncMock(return_value=empty)
    return session


def _draft_employee(**overrides: Any) -> SimpleNamespace:
    emp = SimpleNamespace(
        employee_id=uuid4(),
        status=Status.NEW.value,
        first_name="Ada",
        last_name="Lovelace",
        date_of_birth="1990-05-05",
        personal_email="ada.p@example.com",
        phone_number="+15550100100",
        email_id=f"draft+{uuid4().hex}@hrms.local",
        employment_start_date="2099-01-15",
        employment_type="FULL_TIME",
        department="HR",
        role="HR",
        company="EAOVA",
        password=None,
        middle_name=None,
        gender=None,
        job_description=None,
        job_rank=None,
        payroll_start_date=None,
        leave_policy_id=uuid4(),
        leave_policy_effective_date=None,
        updated_date=None,
        updated_by=None,
        employee_code="ADA_LOV",
    )
    for key, value in overrides.items():
        setattr(emp, key, value)
    return emp


def _onboarding(employee_id: Any) -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid4(),
        employee_id=employee_id,
        status=OnboardingStatus.NOT_STARTED,
        invite_token_hash=None,
        invite_token_expires_at=None,
        invite_sent_at=None,
        invite_accepted_at=None,
    )


async def _stub_invite_deps(
    svc: EmployeeService,
    emp: SimpleNamespace,
    onboarding: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _get(_session: Any, _employee_id: Any) -> SimpleNamespace:
        return emp

    async def _apply(*_a: Any, **_k: Any) -> None:
        return None

    async def _ensure_biz(*_a: Any, **_k: Any) -> None:
        return None

    async def _to_dict(_session: Any, employee: Any, **_k: Any) -> dict[str, Any]:
        return {
            "status": employee.status,
            "employeeCode": getattr(employee, "employee_code", None),
            "officialEmail": employee.email_id,
        }

    async def _ensure(*_a: Any, **_k: Any) -> SimpleNamespace:
        return onboarding

    monkeypatch.setattr(svc, "_get", _get)
    monkeypatch.setattr(svc, "_apply_master_fields", _apply)
    monkeypatch.setattr(svc, "_ensure_business_employee_id", _ensure_biz)
    monkeypatch.setattr(svc, "_to_dict", _to_dict)
    monkeypatch.setattr(svc, "_apply_profile_payload", _apply)
    monkeypatch.setattr(
        "app.modules.employee.service.ensure_onboarding_for_employee",
        _ensure,
    )
    monkeypatch.setattr(
        "app.modules.employee.service.apply_profile_fields",
        MagicMock(),
    )
    monkeypatch.setattr(
        "app.modules.employee.service.assign_or_change_leave_policy",
        AsyncMock(return_value=True),
    )


def _invite_body(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "firstName": "Ada",
        "lastName": "Lovelace",
        "dateOfBirth": "1990-05-05",
        "officialEmail": "ada@example.com",
        "personalEmail": "ada.p@example.com",
        "phoneNumber": "+15550100100",
        "dateOfJoining": "2099-01-15",
        "company": "EAOVA",
        "leavePolicyId": str(uuid4()),
    }
    body.update(overrides)
    return body


@pytest.mark.asyncio
async def test_invite_success_sends_email_with_name_company_and_link(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    svc = EmployeeService()
    session = _session()
    emp = _draft_employee()
    onboarding = _onboarding(emp.employee_id)
    await _stub_invite_deps(svc, emp, onboarding, monkeypatch)
    captured: dict[str, Any] = {}

    async def _send(**kwargs: Any) -> None:
        captured.update(kwargs)

    monkeypatch.setattr("app.mail.invite.send_email", _send)

    result = await svc.invite_draft(
        session,
        emp.employee_id,
        _invite_body(),
        actor={"firstName": "Pat", "lastName": "HR"},
    )

    assert result["status"] == Status.PENDING
    assert emp.status == Status.PENDING
    assert onboarding.invite_token_hash is None
    assert onboarding.invite_sent_at is not None
    assert captured["to_email"] == "ada@example.com"
    assert captured["subject"]
    assert "Ada Lovelace" in captured["text_body"]
    assert "EAOVA" in captured["text_body"]
    # Microsoft sign-in: link to the app, no token or password to set.
    assert "http://localhost:3001" in captured["text_body"]
    assert "Sign in with Microsoft" in captured["text_body"]
    assert "token=" not in captured["text_body"]
    assert "password to set" in captured["text_body"]
    assert "Ada Lovelace" in (captured.get("html_body") or "")
    session.rollback.assert_not_awaited()


@pytest.mark.asyncio
async def test_invite_smtp_failure_rolls_back_and_does_not_return_invited(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    svc = EmployeeService()
    session = _session()
    emp = _draft_employee()
    original_status = emp.status
    onboarding = _onboarding(emp.employee_id)
    await _stub_invite_deps(svc, emp, onboarding, monkeypatch)

    async def _fail(**_kwargs: Any) -> None:
        raise MailSendError("Could not send the invite email. Mail server rejected the login.")

    monkeypatch.setattr("app.mail.invite.send_email", _fail)

    with pytest.raises(HTTPException) as exc:
        await svc.invite_draft(
            session,
            emp.employee_id,
            _invite_body(),
            actor={"firstName": "Pat", "lastName": "HR"},
        )

    assert exc.value.status_code == 502
    assert "invite email" in str(exc.value.detail).lower()
    session.rollback.assert_awaited()
    # In-memory status may have flipped; rollback is what prevents persist.
    assert emp.status != original_status
    assert emp.status == Status.PENDING


@pytest.mark.asyncio
async def test_invite_missing_recipient_fails_before_send(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    svc = EmployeeService()
    session = _session()
    emp = _draft_employee()
    onboarding = _onboarding(emp.employee_id)
    await _stub_invite_deps(svc, emp, onboarding, monkeypatch)
    send = AsyncMock()
    monkeypatch.setattr("app.mail.invite.send_email", send)

    with pytest.raises(HTTPException) as exc:
        await svc.invite_draft(
            session,
            emp.employee_id,
            _invite_body(officialEmail="", emailId=""),
            actor={"firstName": "Pat", "lastName": "HR"},
        )

    assert exc.value.status_code == 400
    assert "officialEmail" in str(exc.value.detail)
    send.assert_not_awaited()
    assert emp.status == Status.NEW.value
    assert onboarding.invite_token_hash is None


@pytest.mark.asyncio
async def test_invite_invalid_recipient_fails_clearly(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    svc = EmployeeService()
    session = _session()
    emp = _draft_employee()
    onboarding = _onboarding(emp.employee_id)
    await _stub_invite_deps(svc, emp, onboarding, monkeypatch)
    send = AsyncMock()
    monkeypatch.setattr("app.mail.invite.send_email", send)

    with pytest.raises(HTTPException) as exc:
        await svc.invite_draft(
            session,
            emp.employee_id,
            _invite_body(officialEmail="not-an-email"),
            actor={"firstName": "Pat", "lastName": "HR"},
        )

    assert exc.value.status_code == 400
    assert "officialemail" in str(exc.value.detail).lower()
    send.assert_not_awaited()
    assert emp.status == Status.NEW.value


@pytest.mark.asyncio
async def test_issue_and_send_invite_missing_smtp_config_rolls_back(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = _session()
    emp = _draft_employee(email_id="ada@example.com")
    onboarding = _onboarding(emp.employee_id)

    async def _fail(**_k: Any) -> None:
        raise MailSendError(
            "Invite email is not configured. Set SMTP_HOST, SMTP_USER, "
            "SMTP_PASS, and SMTP_FROM_EMAIL."
        )

    monkeypatch.setattr("app.mail.invite.send_email", _fail)

    with pytest.raises(HTTPException) as exc:
        await issue_and_send_invite(session, employee=emp, onboarding=onboarding)

    assert exc.value.status_code == 503
    session.rollback.assert_awaited()


@pytest.mark.asyncio
async def test_send_email_rejects_blank_recipient(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.mail.smtp import send_email

    send = AsyncMock()
    monkeypatch.setattr("app.mail.smtp.aiosmtplib.send", send)
    with pytest.raises(MailSendError, match="valid work email"):
        await send_email(to_email="  ", subject="x", text_body="y")
    send.assert_not_awaited()


@pytest.mark.asyncio
async def test_send_email_missing_config(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.mail.smtp import send_email

    monkeypatch.setattr(
        "app.mail.smtp.get_settings",
        lambda: SimpleNamespace(
            smtp_enabled=True,
            smtp_host="",
            smtp_port=587,
            smtp_user="",
            smtp_pass="",
            smtp_from_email="",
            smtp_from_name="EAOVA",
        ),
    )
    with pytest.raises(MailSendError, match="not configured"):
        await send_email(
            to_email="ada@example.com",
            subject="Invite",
            text_body="Hi",
        )


@pytest.mark.asyncio
async def test_first_microsoft_sign_in_marks_invite_accepted(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    emp = _draft_employee(email_id="ada@example.com")
    onboarding = _onboarding(emp.employee_id)
    onboarding.invite_sent_at = datetime.now(UTC) - timedelta(hours=1)
    session = _session()
    found = MagicMock()
    found.scalar_one_or_none.return_value = onboarding
    session.execute = AsyncMock(return_value=found)

    assert await mark_invite_accepted(session, emp) is True
    assert onboarding.invite_accepted_at is not None

    # Later sign-ins leave it alone.
    assert await mark_invite_accepted(session, emp) is False


@pytest.mark.asyncio
async def test_sign_in_without_an_invite_changes_nothing() -> None:
    emp = _draft_employee(email_id="ada@example.com")
    onboarding = _onboarding(emp.employee_id)  # never invited
    session = _session()
    found = MagicMock()
    found.scalar_one_or_none.return_value = onboarding
    session.execute = AsyncMock(return_value=found)
    assert await mark_invite_accepted(session, emp) is False
    assert onboarding.invite_accepted_at is None


@pytest.mark.asyncio
async def test_resend_invite_sends_again(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    svc = EmployeeService()
    session = _session()
    emp = _draft_employee(
        status=Status.ACTIVE.value,
        email_id="venkata@example.com",
        password=None,
    )
    onboarding = _onboarding(emp.employee_id)
    onboarding.invite_token_hash = "old-hash"
    onboarding.invite_sent_at = datetime.now(UTC) - timedelta(days=1)
    await _stub_invite_deps(svc, emp, onboarding, monkeypatch)
    send = AsyncMock()
    monkeypatch.setattr("app.mail.invite.send_email", send)

    payload = await svc.resend_invite(
        session, emp.employee_id, actor={"firstName": "Pat", "lastName": "HR"}
    )

    send.assert_awaited_once()
    # No invite tokens with Microsoft sign-in; the resend just re-records the invite.
    assert onboarding.invite_token_hash is None
    assert onboarding.invite_sent_at > datetime.now(UTC) - timedelta(minutes=1)
    assert onboarding.invite_accepted_at is None
    assert payload["inviteOutstanding"] is True
    assert payload["hasLoginPassword"] is False


@pytest.mark.asyncio
async def test_resend_invite_rejects_new_draft() -> None:
    svc = EmployeeService()
    session = _session()
    emp = _draft_employee(status=Status.NEW.value, password=None)

    async def _get(_session: Any, _employee_id: Any) -> SimpleNamespace:
        return emp

    svc._get = _get  # type: ignore[method-assign]

    with pytest.raises(HTTPException) as exc:
        await svc.resend_invite(
            session, emp.employee_id, actor={"firstName": "Pat", "lastName": "HR"}
        )
    assert exc.value.status_code == 400
    assert "new drafts" in str(exc.value.detail).lower()


@pytest.mark.asyncio
async def test_resend_invite_rejects_accepted(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    svc = EmployeeService()
    session = _session()
    emp = _draft_employee(
        status=Status.ACTIVE.value,
        email_id="ada@example.com",
        password=None,
    )
    onboarding = _onboarding(emp.employee_id)
    onboarding.invite_accepted_at = datetime.now(UTC)
    await _stub_invite_deps(svc, emp, onboarding, monkeypatch)
    send = AsyncMock()
    monkeypatch.setattr("app.mail.invite.send_email", send)

    with pytest.raises(HTTPException) as exc:
        await svc.resend_invite(
            session, emp.employee_id, actor={"firstName": "Pat", "lastName": "HR"}
        )
    assert exc.value.status_code == 400
    assert "already been accepted" in str(exc.value.detail).lower()
    send.assert_not_awaited()


@pytest.mark.asyncio
async def test_resend_invite_rejects_when_password_set(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    svc = EmployeeService()
    session = _session()
    emp = _draft_employee(
        status=Status.ACTIVE.value,
        email_id="ada@example.com",
        password="already-hashed",
    )
    onboarding = _onboarding(emp.employee_id)
    await _stub_invite_deps(svc, emp, onboarding, monkeypatch)
    send = AsyncMock()
    monkeypatch.setattr("app.mail.invite.send_email", send)

    with pytest.raises(HTTPException) as exc:
        await svc.resend_invite(
            session, emp.employee_id, actor={"firstName": "Pat", "lastName": "HR"}
        )
    assert exc.value.status_code == 400
    assert "login password" in str(exc.value.detail).lower()
    send.assert_not_awaited()


@pytest.mark.asyncio
async def test_resend_invite_smtp_failure_rolls_back(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    svc = EmployeeService()
    session = _session()
    emp = _draft_employee(
        status=Status.ACTIVE.value,
        email_id="venkata@example.com",
        password=None,
    )
    onboarding = _onboarding(emp.employee_id)
    await _stub_invite_deps(svc, emp, onboarding, monkeypatch)

    async def _fail(**_k: Any) -> None:
        raise MailSendError("SMTP relay failed")

    monkeypatch.setattr("app.mail.invite.send_email", _fail)

    with pytest.raises(HTTPException) as exc:
        await svc.resend_invite(
            session, emp.employee_id, actor={"firstName": "Pat", "lastName": "HR"}
        )
    assert exc.value.status_code == 502
    session.rollback.assert_awaited()
