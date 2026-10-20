"""Outbound email hooks for weekly timesheet workflow (Dev 3).

Soft-fail pattern matches ESS notify modules: skip when SMTP disabled or
recipient missing; log MailSendError without failing the workflow request.
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


def _employee_display_name(employee: Any) -> str:
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


def _format_week_range(week_start_date: Any, week_end_date: Any) -> str:
    start = getattr(week_start_date, "isoformat", lambda: str(week_start_date))()
    end = getattr(week_end_date, "isoformat", lambda: str(week_end_date))()
    return f"{start} – {end}"


def _public_app_url(path: str) -> str:
    settings = get_settings()
    return f"{settings.app_public_url.rstrip('/')}/{path.lstrip('/')}"


def _employee_timesheets_url() -> str:
    """Self Time Sheets in Employee Portal."""
    return _public_app_url("employee-portal")


def _timesheet_review_url() -> str:
    """Manager / HR timesheet queue in Employee Portal Manage."""
    return _public_app_url("employee-portal/manage")


async def _load_employee(session: AsyncSession, employee_id: UUID) -> Employee | None:
    return await session.get(Employee, employee_id)


async def notify_manager_timesheet_submitted(
    session: AsyncSession,
    *,
    employee: Any,
    manager_id: UUID | None,
    week_start_date: Any,
    week_end_date: Any,
) -> None:
    """TS-DATA-3 / TS-DATA-5 — email reporting manager on submit/resubmit."""
    settings = get_settings()
    if not settings.smtp_enabled:
        logger.info("Skipping timesheet-submitted email — SMTP_ENABLED is false")
        return
    if manager_id is None:
        logger.info(
            "Skipping timesheet-submitted email — no reporting manager for employee %s",
            getattr(employee, "employee_id", None),
        )
        return

    manager = await _load_employee(session, manager_id)
    if manager is None:
        logger.info(
            "Skipping timesheet-submitted email — manager %s not found",
            manager_id,
        )
        return

    to_email = (manager.email_id or "").strip()
    if not to_email or "@" not in to_email:
        logger.info(
            "Skipping timesheet-submitted email — manager %s has no work email",
            manager_id,
        )
        return

    email = render(
        "timesheet.submitted",
        employee_name=_employee_display_name(employee),
        employee_code=_employee_code(employee),
        week=_format_week_range(week_start_date, week_end_date),
        review_url=_timesheet_review_url(),
    )
    try:
        await send_email(
            to_email=to_email,
            subject=email.subject,
            text_body=email.text_body,
            html_body=email.html_body,
            event="timesheet.submitted",
        )
    except MailSendError:
        logger.exception(
            "Timesheet-submitted email failed for employee %s week %s",
            getattr(employee, "employee_id", None),
            week_start_date,
        )


async def notify_employee_timesheet_approved(
    session: AsyncSession,
    *,
    employee: Any,
    week_start_date: Any,
    week_end_date: Any,
) -> None:
    """TS-DATA-7 — email employee when timesheet is approved."""
    settings = get_settings()
    if not settings.smtp_enabled:
        logger.info("Skipping timesheet-approved email — SMTP_ENABLED is false")
        return

    to_email = (getattr(employee, "email_id", None) or "").strip()
    if not to_email or "@" not in to_email:
        logger.info(
            "Skipping timesheet-approved email — employee %s has no work email",
            getattr(employee, "employee_id", None),
        )
        return

    email = render(
        "timesheet.approved",
        employee_name=_employee_display_name(employee),
        week=_format_week_range(week_start_date, week_end_date),
        timesheets_url=_employee_timesheets_url(),
    )
    try:
        await send_email(
            to_email=to_email,
            subject=email.subject,
            text_body=email.text_body,
            html_body=email.html_body,
            event="timesheet.approved",
        )
    except MailSendError:
        logger.exception(
            "Timesheet-approved email failed for employee %s week %s",
            getattr(employee, "employee_id", None),
            week_start_date,
        )


async def notify_employee_timesheet_rejected(
    session: AsyncSession,
    *,
    employee: Any,
    week_start_date: Any,
    week_end_date: Any,
    comment: str,
) -> None:
    """TS-DATA-7 / TS-DATA-14 — email employee when timesheet is rejected."""
    settings = get_settings()
    if not settings.smtp_enabled:
        logger.info("Skipping timesheet-rejected email — SMTP_ENABLED is false")
        return

    to_email = (getattr(employee, "email_id", None) or "").strip()
    if not to_email or "@" not in to_email:
        logger.info(
            "Skipping timesheet-rejected email — employee %s has no work email",
            getattr(employee, "employee_id", None),
        )
        return

    email = render(
        "timesheet.rejected",
        employee_name=_employee_display_name(employee),
        week=_format_week_range(week_start_date, week_end_date),
        reason=(comment or "").strip() or "—",
        timesheets_url=_employee_timesheets_url(),
    )
    try:
        await send_email(
            to_email=to_email,
            subject=email.subject,
            text_body=email.text_body,
            html_body=email.html_body,
            event="timesheet.rejected",
        )
    except MailSendError:
        logger.exception(
            "Timesheet-rejected email failed for employee %s week %s",
            getattr(employee, "employee_id", None),
            week_start_date,
        )
