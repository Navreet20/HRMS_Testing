"""Outbound email for leave decisions (timesheet email pattern).

Soft-fail: skip when SMTP is disabled or the employee has no work email; log
MailSendError without failing the approve/reject request. Wording lives in
``app/mail/templates.py``.
"""

from __future__ import annotations

import logging
from typing import Any

from app.core.config import get_settings
from app.mail.outbox import send_email
from app.mail.smtp import MailSendError
from app.mail.templates import RenderedEmail, render
from app.modules.leave_requests.notify import employee_display_name, format_leave_range

logger = logging.getLogger(__name__)


def _leaves_url() -> str:
    settings = get_settings()
    return f"{settings.app_public_url.rstrip('/')}/employee-portal"


async def _send_to_employee(
    employee: Any, *, email: RenderedEmail, event: str, kind: str
) -> None:
    settings = get_settings()
    if not settings.smtp_enabled:
        logger.info("Skipping leave-%s email — SMTP_ENABLED is false", kind)
        return
    to_email = (getattr(employee, "email_id", None) or "").strip()
    if not to_email or "@" not in to_email:
        logger.info(
            "Skipping leave-%s email — employee %s has no work email",
            kind,
            getattr(employee, "employee_id", None),
        )
        return
    try:
        await send_email(
            to_email=to_email,
            subject=email.subject,
            text_body=email.text_body,
            html_body=email.html_body,
            event=event,
        )
    except MailSendError:
        logger.exception(
            "Leave-%s email failed for employee %s",
            kind,
            getattr(employee, "employee_id", None),
        )


async def notify_employee_leave_approved(
    *, employee: Any, leave_type_name: str, from_date: Any, to_date: Any, leave_days: float
) -> None:
    email = render(
        "leave.approved",
        employee_name=employee_display_name(employee),
        leave_type=leave_type_name,
        dates=format_leave_range(from_date, to_date),
        days=f"{leave_days:g}",
        leaves_url=_leaves_url(),
    )
    await _send_to_employee(employee, email=email, event="leave.approved", kind="approved")


async def notify_employee_leave_rejected(
    *,
    employee: Any,
    leave_type_name: str,
    from_date: Any,
    to_date: Any,
    reason: str,
    after_approval: bool = False,
) -> None:
    email = render(
        "leave.rejected",
        employee_name=employee_display_name(employee),
        previously="previously approved " if after_approval else "",
        leave_type=leave_type_name,
        dates=format_leave_range(from_date, to_date),
        reason=reason,
        leaves_url=_leaves_url(),
    )
    await _send_to_employee(employee, email=email, event="leave.rejected", kind="rejected")
