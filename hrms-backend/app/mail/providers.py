"""Email delivery providers, chosen with ``EMAIL_PROVIDER``.

Only ``smtp`` exists today (the SMTP_* settings, e.g. the company mail server). A Microsoft
Graph or Amazon SES provider can be added here without touching any
notification code.
"""

from __future__ import annotations

from app.core.config import get_settings
from app.mail import smtp
from app.mail.smtp import MailSendError


async def deliver_email(
    *,
    to_email: str,
    subject: str,
    text_body: str,
    html_body: str | None = None,
) -> None:
    """Send one email now through the configured provider."""
    provider = (get_settings().email_provider or "smtp").strip().lower()
    if provider == "smtp":
        await smtp.send_email(
            to_email=to_email,
            subject=subject,
            text_body=text_body,
            html_body=html_body,
        )
        return
    raise MailSendError(f"Unknown EMAIL_PROVIDER '{provider}'. Use 'smtp'.")
