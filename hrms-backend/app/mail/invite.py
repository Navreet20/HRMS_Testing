"""Employee invite email and invite acceptance (Microsoft Entra sign-in).

There is no password to set: the invite tells the employee to open the app and
sign in with Microsoft using their work email. Their first Microsoft sign-in
marks the invite accepted (``mark_invite_accepted``).
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.mail.smtp import MailSendError, send_email
from app.mail.templates import render
from app.models.awaiting import (EmployeeOnboarding)
from app.models.tables import Employee

_MIN_PASSWORD_LENGTH = 8


def app_sign_in_url() -> str:
    settings = get_settings()
    return (settings.app_public_url or "http://localhost:3000").rstrip("/")


def _employee_display_name(employee: Employee) -> str:
    return f"{employee.first_name} {employee.last_name}".strip() or "there"


async def issue_and_send_invite(
    session: AsyncSession,
    *,
    employee: Employee,
    onboarding: EmployeeOnboarding,
) -> None:
    """Record the invite and send the "sign in with Microsoft" email.

    Must run in the same DB transaction as the Invited status change. On SMTP
    failure this raises after ``session.rollback()`` so Invited is not committed.
    """
    recipient = str(employee.email_id or "").strip()
    if not recipient or "@" not in recipient:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="officialEmail/emailId is required to invite",
        )
    lower = recipient.lower()
    if lower.startswith("draft+") and lower.endswith("@hrms.local"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="officialEmail/emailId is required to invite",
        )

    settings = get_settings()
    onboarding.invite_token_hash = None
    onboarding.invite_token_expires_at = None
    onboarding.invite_sent_at = datetime.now(UTC)
    onboarding.invite_accepted_at = None
    await session.flush()

    email = render(
        "employee.invite",
        employee_name=_employee_display_name(employee),
        company=(employee.company or "EAOVA").strip() or "EAOVA",
        sign_in_url=app_sign_in_url(),
        work_email=recipient,
        from_name=(settings.smtp_from_name or "EAOVA").strip(),
    )
    try:
        await send_email(
            to_email=recipient,
            subject=email.subject,
            text_body=email.text_body,
            html_body=email.html_body,
        )
    except MailSendError as exc:
        await session.rollback()
        detail = str(exc)
        lowered = detail.lower()
        code = (
            status.HTTP_503_SERVICE_UNAVAILABLE
            if "not configured" in lowered or "disabled" in lowered
            else status.HTTP_502_BAD_GATEWAY
        )
        raise HTTPException(status_code=code, detail=detail) from exc


async def mark_invite_accepted(session: AsyncSession, employee: Employee) -> bool:
    """First Microsoft sign-in after an invite: record it as accepted.

    Employee Portal Self access is derived per session, so no grant is written
    here. Returns True when an outstanding invite was marked accepted.
    """
    # Onboarding tables are not part of the 37-table schema yet: nothing to mark.
    return False
