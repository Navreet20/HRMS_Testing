"""Emails sent when a manager approves or rejects an Employee Portal request.

Wording lives in ``app/mail/templates.py`` (editable in Company Setup).
Recipients: whoever raised the request, the employee it is for when that is a
different person, and the other people who manage that kind of request.
"""

from __future__ import annotations

import logging
from typing import Any

from app.core.config import get_settings
from app.mail.outbox import send_email
from app.mail.recipients import notification_recipients
from app.mail.smtp import MailSendError
from app.mail.templates import RenderedEmail, render
from app.models.tables import Employee

logger = logging.getLogger(__name__)

# Which managers get the "someone decided this" copy.
_MANAGERS = {
    "asset": ("assets", None),
    "profile": ("employeePortal", "manage"),
}


def _name(employee: Employee | None) -> str:
    if employee is None:
        return "—"
    return f"{employee.first_name or ''} {employee.last_name or ''}".strip() or "—"


def _email(employee: Employee | None) -> str:
    address = ((employee.email_id if employee is not None else "") or "").strip().lower()
    if "@" not in address or (address.startswith("draft+") and address.endswith("@hrms.local")):
        return ""
    return address


async def _send(to_email: str, email: RenderedEmail, event: str, request_id: Any) -> None:
    try:
        await send_email(
            to_email=to_email,
            subject=email.subject,
            text_body=email.text_body,
            html_body=email.html_body,
            event=event,
        )
    except MailSendError:
        logger.exception("Decision email (%s) failed for request %s", event, request_id)


async def notify_request_decision(
    *,
    kind: str,
    decision: str,
    requester: Employee | None,
    subject: Employee | None,
    request_id: Any,
    request_type: str,
    summary: str,
    decided_by: str,
    decided_by_email: str = "",
    comment: str | None = None,
    outcome: str | None = None,
    send_to_requester: bool = True,
    subject_already_emailed: bool = False,
    managers_already_emailed: bool = False,
) -> None:
    """Tell the requester (and the subject), then the other managers. Never raises.

    Nobody gets the same news twice: one email if the requester and the subject
    are the same person; ``send_to_requester`` is False when the requester
    already gets a dedicated email for this decision (a profile change being
    approved); ``subject_already_emailed`` / ``managers_already_emailed`` are
    True when Assets already sent its own email (assigned, swapped, lost).
    """
    if not get_settings().smtp_enabled:
        logger.info("Skipping request decision emails - SMTP_ENABLED is false")
        return
    try:
        affected: list[str] = []
        for person in (requester, subject):
            address = _email(person)
            if address and address not in affected:
                affected.append(address)
        # Everyone involved is skipped for the manager copy, told or not.
        involved = list(affected)
        subject_address = _email(subject)
        if subject_already_emailed and subject_address in affected:
            affected.remove(subject_address)

        common = {
            "requester_name": _name(requester),
            "subject_name": _name(subject),
            "request_type": request_type,
            "summary": summary or "—",
            "decided_by": decided_by or "—",
            "comment": (comment or "").strip() or "—",
            "outcome": (outcome or "").strip() or "—",
        }

        if send_to_requester and affected:
            key = "asset_request" if kind == "asset" else "profile_update"
            approved = decision == "approved"
            template = (
                f"{key}.approved" if approved and kind == "asset" else f"{key}.rejected"
            )
            if kind == "profile" and approved:
                template = ""  # sent by notify_profile_update_completed
            if template:
                email = render(template, **common)
                for address in affected:
                    await _send(address, email, template, request_id)

        module_key, submodule = _MANAGERS[kind]
        managers = await notification_recipients(module_key, submodule)
        skip = {*involved, decided_by_email.strip().lower()}
        copy = render("request.decided", decision=decision, **common)
        for address in [] if managers_already_emailed else managers:
            if address not in skip:
                await _send(address, copy, "request.decided", request_id)
    except Exception:  # noqa: BLE001 - a mail problem must not undo the decision
        logger.exception("Could not send decision emails for request %s", request_id)
