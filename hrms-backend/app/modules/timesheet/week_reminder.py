"""TS-DATA-9 — Tuesday reminders for timesheet_required employees.

Outstanding prior weeks: missing header, Draft, or Rejected (exclude
Submitted / Approved). Soft-fail SMTP matches ESS notify modules.
"""

from __future__ import annotations

import logging
import uuid
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.roles import Status
from app.mail.outbox import send_email
from app.mail.smtp import MailSendError
from app.mail.templates import bullet_lines, render
from app.models.tables import Company, Employee, TimesheetHeader
from app.modules.timesheet.constants import (
    TIMESHEET_STATUS_APPROVED,
    TIMESHEET_STATUS_SUBMITTED,
)
from app.modules.timesheet.week_service import sunday_of_week

logger = logging.getLogger(__name__)

# Python weekday(): Monday=0 … Sunday=6. Default Tuesday until Company Configuration is set.
DEFAULT_REMINDER_WEEKDAY = 1

_EXCLUDED_STATUSES = frozenset(
    {TIMESHEET_STATUS_SUBMITTED, TIMESHEET_STATUS_APPROVED}
)


def _parse_employment_start(raw: str | None) -> date | None:
    if not raw:
        return None
    text = str(raw).strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def _prior_week_sundays(*, start_day: date, today: date) -> list[date]:
    """Sundays from employment week through the week before the current week."""
    first_sunday = sunday_of_week(start_day)
    current_sunday = sunday_of_week(today)
    last_prior = current_sunday - timedelta(days=7)
    if last_prior < first_sunday:
        return []
    weeks: list[date] = []
    cursor = first_sunday
    while cursor <= last_prior:
        weeks.append(cursor)
        cursor += timedelta(days=7)
    return weeks


def _format_week_label(week_start: date) -> str:
    week_end = week_start + timedelta(days=6)
    return f"{week_start.isoformat()} – {week_end.isoformat()}"


async def find_outstanding_prior_weeks(
    session: AsyncSession,
    *,
    employee: Employee,
    today: date,
) -> list[date]:
    start = _parse_employment_start(employee.employment_start_date)
    if start is None:
        logger.info(
            "Skipping reminder scan for employee %s — invalid employment_start_date",
            employee.employee_id,
        )
        return []

    candidate_weeks = _prior_week_sundays(start_day=start, today=today)
    if not candidate_weeks:
        return []

    result = await session.execute(
        select(TimesheetHeader.week_start_date, TimesheetHeader.status).where(
            TimesheetHeader.employee_id == employee.employee_id,
            TimesheetHeader.week_start_date >= candidate_weeks[0],
            TimesheetHeader.week_start_date <= candidate_weeks[-1],
        )
    )
    status_by_week = {row[0]: row[1] for row in result.all()}

    outstanding: list[date] = []
    for week_start in candidate_weeks:
        status = status_by_week.get(week_start)
        if status is None or status not in _EXCLUDED_STATUSES:
            outstanding.append(week_start)
    return outstanding


async def _send_reminder_email(
    *,
    employee: Employee,
    outstanding_weeks: list[date],
) -> bool:
    settings = get_settings()
    if not settings.smtp_enabled:
        logger.info("Skipping timesheet reminder — SMTP_ENABLED is false")
        return False

    to_email = (employee.email_id or "").strip()
    if not to_email or "@" not in to_email:
        logger.info(
            "Skipping timesheet reminder — employee %s has no work email",
            employee.employee_id,
        )
        return False

    email = render(
        "timesheet.reminder",
        employee_name=f"{employee.first_name or ''} {employee.last_name or ''}".strip()
        or "Employee",
        weeks=bullet_lines([_format_week_label(w) for w in outstanding_weeks]),
        timesheets_url=f"{settings.app_public_url.rstrip('/')}/employee-portal",
    )
    try:
        await send_email(
            to_email=to_email,
            subject=email.subject,
            text_body=email.text_body,
            html_body=email.html_body,
            event="timesheet.reminder",
        )
        return True
    except MailSendError:
        logger.exception(
            "Timesheet reminder email failed for employee %s",
            employee.employee_id,
        )
        return False


async def _send_manager_review_email(
    *,
    manager: Employee,
    items: list[tuple[Employee, date]],
) -> bool:
    settings = get_settings()
    if not settings.smtp_enabled:
        logger.info("Skipping manager timesheet review reminder — SMTP_ENABLED is false")
        return False

    to_email = (manager.email_id or "").strip()
    if not to_email or "@" not in to_email:
        logger.info(
            "Skipping manager timesheet review reminder — manager %s has no work email",
            manager.employee_id,
        )
        return False

    lines = []
    for employee, week_start in items:
        emp_name = (
            f"{employee.first_name or ''} {employee.last_name or ''}".strip()
            or str(employee.employee_id)
        )
        lines.append(f"{emp_name}: {_format_week_label(week_start)}")
    email = render(
        "timesheet.review_reminder",
        manager_name=f"{manager.first_name or ''} {manager.last_name or ''}".strip()
        or "Manager",
        timesheets=bullet_lines(lines),
        manage_url=f"{settings.app_public_url.rstrip('/')}/employee-portal/manage",
    )
    try:
        await send_email(
            to_email=to_email,
            subject=email.subject,
            text_body=email.text_body,
            html_body=email.html_body,
            event="timesheet.review_reminder",
        )
        return True
    except MailSendError:
        logger.exception(
            "Manager timesheet review reminder failed for manager %s",
            manager.employee_id,
        )
        return False


async def notify_managers_of_unreviewed(session: AsyncSession) -> dict:
    """Email reporting managers who have Submitted weeks still waiting."""
    result = await session.execute(
        select(TimesheetHeader, Employee)
        .join(Employee, Employee.employee_id == TimesheetHeader.employee_id)
        .where(
            TimesheetHeader.status == TIMESHEET_STATUS_SUBMITTED,
            Employee.reporting_manager_id.is_not(None),
        )
    )
    by_manager: dict[uuid.UUID, list[tuple[Employee, date]]] = {}
    for header, emp in result.all():
        manager_id = emp.reporting_manager_id
        if manager_id is None:
            continue
        by_manager.setdefault(manager_id, []).append(
            (emp, header.week_start_date)
        )

    emailed = 0
    failed_or_skipped = 0
    details: list[dict] = []
    for manager_id, items in by_manager.items():
        manager_result = await session.execute(
            select(Employee).where(Employee.employee_id == manager_id)
        )
        manager = manager_result.scalar_one_or_none()
        if manager is None:
            continue
        sent = await _send_manager_review_email(manager=manager, items=items)
        details.append(
            {
                "managerId": str(manager.employee_id),
                "email": (manager.email_id or "").strip(),
                "waitingCount": len(items),
                "emailed": sent,
            }
        )
        if sent:
            emailed += 1
        else:
            failed_or_skipped += 1
    return {
        "emailed": emailed,
        "failedOrSkippedSend": failed_or_skipped,
        "managers": details,
    }


async def resolve_reminder_weekday(session: AsyncSession) -> int:
    result = await session.execute(
        select(Company.timesheet_reminder_weekday).order_by(Company.company_name).limit(1)
    )
    raw = result.scalar_one_or_none()
    try:
        weekday = int(raw) if raw is not None else DEFAULT_REMINDER_WEEKDAY
    except (TypeError, ValueError):
        return DEFAULT_REMINDER_WEEKDAY
    if weekday < 0 or weekday > 6:
        return DEFAULT_REMINDER_WEEKDAY
    return weekday


async def run_timesheet_reminders(
    session: AsyncSession,
    *,
    today: date | None = None,
    force: bool = False,
) -> dict:
    """Email timesheet_required employees with outstanding prior weeks.

    Uses Company Configuration reminder weekday (default Tuesday) unless
    ``force=True`` (for tests / manual runs).
    """
    day = today or date.today()
    reminder_weekday = await resolve_reminder_weekday(session)
    if not force and day.weekday() != reminder_weekday:
        logger.info(
            "Timesheet reminder job skipped — today=%s weekday=%s (need %s)",
            day.isoformat(),
            day.weekday(),
            reminder_weekday,
        )
        return {
            "skipped": True,
            "reason": "not_reminder_day",
            "runDate": day.isoformat(),
            "candidates": 0,
            "emailed": 0,
            "failedOrSkippedSend": 0,
            "employees": [],
        }

    result = await session.execute(
        select(Employee).where(
            Employee.timesheet_required.is_(True),
            Employee.is_system_account.is_(False),
            Employee.status == Status.ACTIVE.value,
        )
    )
    employees = list(result.scalars().all())

    emailed = 0
    failed_or_skipped = 0
    details: list[dict] = []

    for emp in employees:
        outstanding = await find_outstanding_prior_weeks(
            session, employee=emp, today=day
        )
        if not outstanding:
            continue
        sent = await _send_reminder_email(
            employee=emp, outstanding_weeks=outstanding
        )
        entry = {
            "employeeId": str(emp.employee_id),
            "email": (emp.email_id or "").strip(),
            "outstandingWeeks": [w.isoformat() for w in outstanding],
            "emailed": sent,
        }
        details.append(entry)
        if sent:
            emailed += 1
        else:
            failed_or_skipped += 1

    manager_result = await notify_managers_of_unreviewed(session)

    return {
        "skipped": False,
        "reason": None,
        "runDate": day.isoformat(),
        "candidates": len(details),
        "emailed": emailed,
        "failedOrSkippedSend": failed_or_skipped,
        "employees": details,
        "managersEmailed": manager_result["emailed"],
        "managersFailedOrSkippedSend": manager_result["failedOrSkippedSend"],
        "managers": manager_result["managers"],
    }
