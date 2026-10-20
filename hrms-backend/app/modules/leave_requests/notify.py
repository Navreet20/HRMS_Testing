"""Outbound email for leave requests (timesheet email pattern).

Soft-fail: skip when SMTP is disabled or the recipient is missing; log
MailSendError without failing the request.
"""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.mail.outbox import send_email
from app.mail.smtp import MailSendError
from app.mail.templates import render
from app.models.tables import Employee

logger = logging.getLogger(__name__)


def employee_display_name(employee: Any) -> str:
    return (
        f"{getattr(employee, 'first_name', '') or ''} "
        f"{getattr(employee, 'last_name', '') or ''}".strip()
        or "Employee"
    )


def _employee_code(employee: Any) -> str:
    return (
        getattr(employee, "business_employee_id", None)
        or getattr(employee, "employee_code", None)
        or ""
    ).strip() or "—"


def _public_app_url(path: str) -> str:
    settings = get_settings()
    return f"{settings.app_public_url.rstrip('/')}/{path.lstrip('/')}"


def format_leave_range(from_date: Any, to_date: Any) -> str:
    start = getattr(from_date, "isoformat", lambda: str(from_date))()
    end = getattr(to_date, "isoformat", lambda: str(to_date))()
    return start if start == end else f"{start} – {end}"


async def notify_manager_leave_submitted(
    session: AsyncSession,
    *,
    employee: Any,
    manager_id: UUID | None,
    leave_type_name: str,
    from_date: Any,
    to_date: Any,
    leave_days: float,
    resubmitted: bool = False,
) -> None:
    """Email the reporting manager when a leave request is submitted or resubmitted."""
    settings = get_settings()
    if not settings.smtp_enabled:
        logger.info("Skipping leave-submitted email — SMTP_ENABLED is false")
        return
    if manager_id is None:
        logger.info(
            "Skipping leave-submitted email — no reporting manager for employee %s",
            getattr(employee, "employee_id", None),
        )
        return
    manager = await session.get(Employee, manager_id)
    to_email = (getattr(manager, "email_id", None) or "").strip()
    if manager is None or not to_email or "@" not in to_email:
        logger.info("Skipping leave-submitted email — manager %s has no work email", manager_id)
        return

    email = render(
        "leave.submitted",
        employee_name=employee_display_name(employee),
        employee_code=_employee_code(employee),
        action="resubmitted" if resubmitted else "submitted",
        leave_type=leave_type_name,
        dates=format_leave_range(from_date, to_date),
        days=f"{leave_days:g}",
        review_url=_public_app_url("employee-portal/manage"),
    )
    try:
        await send_email(
            to_email=to_email,
            subject=email.subject,
            text_body=email.text_body,
            html_body=email.html_body,
            event="leave.submitted",
        )
    except MailSendError:
        logger.exception(
            "Leave-submitted email failed for employee %s",
            getattr(employee, "employee_id", None),
        )
