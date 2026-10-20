"""Async SMTP delivery via aiosmtplib (STARTTLS, SSL or plain, per SMTP_SECURITY)."""

from __future__ import annotations

import logging
import ssl
from email.message import EmailMessage
from email.utils import formataddr

import aiosmtplib
import certifi

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class MailSendError(Exception):
    """Invite/mail delivery failed. ``str(self)`` is safe to return to the API client."""


def _secret_value(value: object) -> str:
    getter = getattr(value, "get_secret_value", None)
    if callable(getter):
        return str(getter() or "")
    return str(value or "")


def _smtp_configured(settings: object) -> bool:
    """Host and sender are required; a login is optional (some company relays
    accept mail from trusted servers without one), but user and password go
    together."""
    host = str(getattr(settings, "smtp_host", "") or "").strip()
    user = str(getattr(settings, "smtp_user", "") or "").strip()
    password = _secret_value(getattr(settings, "smtp_pass", "")).strip()
    from_email = str(getattr(settings, "smtp_from_email", "") or "").strip()
    return bool(host and from_email and bool(user) == bool(password))


def _safe_error_text(exc: BaseException, *, secret: str) -> str:
    text = str(exc).strip() or type(exc).__name__
    if secret:
        text = text.replace(secret, "***")
    return text[:300]


async def send_email(
    *,
    to_email: str,
    subject: str,
    text_body: str,
    html_body: str | None = None,
) -> None:
    """Send one message over STARTTLS. Never logs the SMTP password."""
    recipient = (to_email or "").strip()
    if not recipient or "@" not in recipient:
        raise MailSendError("A valid work email is required to send the invite.")

    settings = get_settings()
    if not settings.smtp_enabled:
        raise MailSendError(
            "Email is disabled. Set SMTP_ENABLED=true and retry."
        )
    if not _smtp_configured(settings):
        raise MailSendError(
            "Email is not configured. Set SMTP_HOST and SMTP_FROM_EMAIL, plus "
            "SMTP_USER and SMTP_PASS if the server needs a login."
        )

    from_email = settings.smtp_from_email.strip()
    from_name = (settings.smtp_from_name or "EAOVA").strip()
    message = EmailMessage()
    message["From"] = formataddr((from_name, from_email))
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(text_body)
    if html_body:
        message.add_alternative(html_body, subtype="html")

    tls_context = ssl.create_default_context(cafile=certifi.where())

    security = getattr(settings, "smtp_security", "starttls")
    username = settings.smtp_user.strip() or None
    try:
        await aiosmtplib.send(
            message,
            hostname=settings.smtp_host.strip(),
            port=int(settings.smtp_port),
            username=username,
            password=_secret_value(settings.smtp_pass) if username else None,
            start_tls=security == "starttls",
            use_tls=security == "ssl",
            tls_context=tls_context,
        )
    except aiosmtplib.SMTPAuthenticationError as exc:
        logger.warning("SMTP authentication failed for host %s", settings.smtp_host)
        raise MailSendError(
            "Could not send the invite email. Mail server rejected the login. "
            "Check SMTP_USER and SMTP_PASS."
        ) from exc
    except aiosmtplib.SMTPRecipientsRefused as exc:
        logger.warning("SMTP refused recipient %s", recipient)
        raise MailSendError(
            "Could not send the invite email. The mail server rejected the "
            "work email address."
        ) from exc
    except aiosmtplib.SMTPException as exc:
        logger.warning(
            "SMTP send failed (%s): %s",
            type(exc).__name__,
            _safe_error_text(exc, secret=_secret_value(settings.smtp_pass)),
        )
        raise MailSendError(
            "Could not send the invite email. Check the work email and SMTP "
            "settings, then try again."
        ) from exc
    except ssl.SSLCertVerificationError as exc:
        logger.warning("SMTP TLS certificate verification failed: %s", type(exc).__name__)
        raise MailSendError(
            "Could not send the invite email. TLS certificate verification failed."
        ) from exc
    except OSError as exc:
        logger.warning("SMTP connection failed: %s", type(exc).__name__)
        raise MailSendError(
            "Could not send the invite email. Could not reach the mail server."
        ) from exc
