"""ESS-DATA-2: email HR when an employee submits a profile update request.

Wording lives in ``app/mail/templates.py``.
"""

from __future__ import annotations

import logging

from app.core.config import get_settings
from app.mail.outbox import send_email
from app.mail.recipients import notification_recipients
from app.mail.smtp import MailSendError
from app.mail.templates import RenderedEmail, bullet_lines, render
from app.models.tables import (Employee)
from app.models.tables import ProfileUpdateRequest

logger = logging.getLogger(__name__)

_FIELD_LABELS = {
    "firstName": "First name",
    "lastName": "Last name",
    "dateOfBirth": "Date of birth",
    "nationality": "Nationality",
}


def _name(employee: Employee) -> str:
    return f"{employee.first_name or ''} {employee.last_name or ''}".strip() or "Employee"


def _code(employee: Employee) -> str:
    return (employee.business_employee_id or employee.employee_code or "").strip() or "—"


async def _send(to_email: str, email: RenderedEmail, *, event: str, request_id: object) -> None:
    try:
        await send_email(
            to_email=to_email,
            subject=email.subject,
            text_body=email.text_body,
            html_body=email.html_body,
            event=event,
        )
    except MailSendError:
        logger.exception("Profile-update email (%s) failed for request %s", event, request_id)


async def notify_hr_profile_update_request(
    *,
    employee: Employee,
    requester: Employee,
    request: ProfileUpdateRequest,
) -> None:
    settings = get_settings()
    if not settings.smtp_enabled:
        logger.info("Skipping profile-update emails — SMTP_ENABLED is false")
        return

    subject_name, subject_code = _name(employee), _code(employee)
    subject_email = (employee.email_id or "").strip() or "—"
    requester_name, requester_code = _name(requester), _code(requester)
    on_behalf = request.submitted_by_employee_id != request.employee_id
    field_label = _FIELD_LABELS.get(request.field_changed, request.field_changed)
    short_description = (request.short_description or "").strip()
    if short_description:
        details = bullet_lines(
            [
                f"Summary: {short_description}",
                f"Details: {(request.long_description or '').strip()}",
            ]
        )
        summary_subject = short_description[:80]
    else:
        details = bullet_lines(
            [
                f"Field: {field_label}",
                f"Current value: {(request.old_value or '').strip() or '—'}",
                f"Requested value: {(request.new_value or '').strip() or '—'}",
            ]
        )
        summary_subject = f"{subject_name} ({field_label})"

    # Whoever approves in Employee Portal → Manage (then Admins, Superadmins).
    recipients = await notification_recipients("employeePortal", "manage")
    if recipients:
        email = render(
            "profile_update.requested",
            submitted_line=(
                f"{requester_name} ({requester_code}) submitted a profile update request "
                f"for {subject_name} ({subject_code})."
                if on_behalf
                else f"{subject_name} ({subject_code}) submitted a profile update request."
            ),
            summary_subject=summary_subject,
            requester_email=(requester.email_id or "").strip() or "—",
            subject_email=subject_email,
            details=details,
            request_id=request.id,
            employees_url=f"{settings.app_public_url.rstrip('/')}/employees",
        )
        for to_email in recipients:
            await _send(to_email, email, event="profile_update.requested", request_id=request.id)
    else:
        logger.info("Skipping HR profile-update email — no one to notify")

    if on_behalf and subject_email != "—":
        email = render(
            "profile_update.on_behalf",
            requester_name=requester_name,
            requester_code=requester_code,
            details=details,
            request_id=request.id,
        )
        await _send(subject_email, email, event="profile_update.on_behalf", request_id=request.id)


async def notify_profile_update_completed(
    *,
    requester: Employee,
    subject: Employee,
    request: ProfileUpdateRequest,
    changes_summary: str,
) -> None:
    """Email submitter (and subject if on-behalf) that the request is completed."""
    settings = get_settings()
    if not settings.smtp_enabled:
        logger.info(
            "Skipping profile-update completion emails — SMTP_ENABLED is false"
        )
        return

    changes = (
        (changes_summary or "").strip()
        or "Your requested profile update was completed."
    )
    summary = (
        request.short_description or request.new_value or ""
    ).strip() or "Profile update"
    on_behalf = request.submitted_by_employee_id != request.employee_id
    requester_email = (requester.email_id or "").strip()
    subject_email = (subject.email_id or "").strip()

    if requester_email:
        email = render(
            "profile_update.completed",
            request_id=request.id,
            summary=summary[:80] if len(summary) > 80 else summary,
            changes=changes,
        )
        await _send(requester_email, email, event="profile_update.completed", request_id=request.id)

    if on_behalf and subject_email and subject_email != requester_email:
        email = render(
            "profile_update.completed_subject",
            employee_name=_name(subject),
            request_id=request.id,
            summary=summary[:80] if len(summary) > 80 else summary,
            changes=changes,
        )
        await _send(
            subject_email, email, event="profile_update.completed_subject", request_id=request.id
        )
