"""Department notification recipients (access → Admins → Superadmins) and SMTP modes."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

import pytest

from app.mail import recipients
from app.mail.smtp import _smtp_configured, send_email


def _lookup(by_module: dict):
    async def _fake(module_key, submodule_key=None, *, include_system_accounts=True):
        return list(by_module.get((module_key, submodule_key, include_system_accounts), []))

    return _fake


@pytest.mark.asyncio
async def test_people_with_the_access_get_it() -> None:
    fake = _lookup({("assets", None, True): ["asha@arohak.com", "ravi@arohak.com"]})
    with patch("app.mail.recipients._full_access_emails", side_effect=fake):
        assert await recipients.notification_recipients("assets") == [
            "asha@arohak.com",
            "ravi@arohak.com",
        ]


@pytest.mark.asyncio
async def test_falls_back_to_company_admins() -> None:
    fake = _lookup({("companySetup", None, False): ["admin@arohak.com"]})
    with patch("app.mail.recipients._full_access_emails", side_effect=fake):
        assert await recipients.notification_recipients("employees", "onboarding") == [
            "admin@arohak.com"
        ]


@pytest.mark.asyncio
async def test_falls_back_to_superadmins_when_no_admins() -> None:
    with (
        patch("app.mail.recipients._full_access_emails", side_effect=_lookup({})),
        patch(
            "app.mail.recipients.get_settings",
            return_value=SimpleNamespace(superadmin_emails="durga@arohak.com, navreet.kaur@cognivance.com"),
        ),
    ):
        assert await recipients.notification_recipients("assets") == [
            "durga@arohak.com",
            "navreet.kaur@cognivance.com",
        ]


def test_clean_drops_blanks_and_duplicates() -> None:
    assert recipients._clean([" A@x.com", "a@x.com", None, "nope"]) == ["a@x.com"]


def _smtp_settings(**overrides):
    base = {
        "smtp_enabled": True,
        "smtp_host": "smtp.cognivance.com",
        "smtp_port": 587,
        "smtp_security": "starttls",
        "smtp_user": "noreply@cognivance.com",
        "smtp_pass": "secret",
        "smtp_from_email": "noreply@cognivance.com",
        "smtp_from_name": "EAOVA",
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def test_login_is_optional_but_user_and_password_go_together() -> None:
    assert _smtp_configured(_smtp_settings()) is True
    assert _smtp_configured(_smtp_settings(smtp_user="", smtp_pass="")) is True
    assert _smtp_configured(_smtp_settings(smtp_pass="")) is False
    assert _smtp_configured(_smtp_settings(smtp_from_email="")) is False


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("security", "start_tls", "use_tls"),
    [("starttls", True, False), ("ssl", False, True), ("none", False, False)],
)
async def test_smtp_security_modes(security, start_tls, use_tls, mock_aiosmtplib_send) -> None:
    with patch("app.mail.smtp.get_settings", return_value=_smtp_settings(smtp_security=security)):
        await send_email(to_email="hr@arohak.com", subject="s", text_body="t")
    kwargs = mock_aiosmtplib_send.await_args.kwargs
    assert (kwargs["start_tls"], kwargs["use_tls"]) == (start_tls, use_tls)


@pytest.mark.asyncio
async def test_server_without_login_sends_without_credentials(mock_aiosmtplib_send) -> None:
    settings = _smtp_settings(smtp_user="", smtp_pass="", smtp_security="none", smtp_port=25)
    with patch("app.mail.smtp.get_settings", return_value=settings):
        await send_email(to_email="hr@arohak.com", subject="s", text_body="t")
    kwargs = mock_aiosmtplib_send.await_args.kwargs
    assert kwargs["username"] is None and kwargs["password"] is None
