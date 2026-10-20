"""ESS-DATA-4: email IT when an employee submits an IT request."""

from __future__ import annotations

import logging

from app.core.config import get_settings
from app.mail.outbox import send_email
from app.mail.recipients import notification_recipients
from app.mail.smtp import MailSendError
from app.mail.templates import render
from app.models.tables import (Employee)
from app.models.awaiting import (ITRequest)

logger = logging.getLogger(__name__)

_CATEGORY_LABELS = {
    "firewall": "Firewall",
    "ram": "RAM",
    "softwareLicense": "Software License",
}


async def notify_it_request(
    *,
    employee: Employee,
    request: ITRequest,
) -> None:
    # No IT permission exists yet, so IT requests go to Assets full access
    # (then Admins, Superadmins).
    recipients = await notification_recipients("assets")
    if not recipients:
        logger.info("Skipping IT-request email — no one to notify")
        return
    settings = get_settings()
    if not settings.smtp_enabled:
        logger.info("Skipping IT-request email — SMTP_ENABLED is false")
        return

    email = render(
        "it_request.submitted",
        employee_name=f"{employee.first_name or ''} {employee.last_name or ''}".strip()
        or "Employee",
        employee_code=(employee.business_employee_id or employee.employee_code or "").strip()
        or "—",
        work_email=(employee.email_id or "").strip() or "—",
        category=_CATEGORY_LABELS.get(request.category, request.category),
        details=(request.details or "").strip() or "—",
        request_id=request.id,
        app_url=f"{settings.app_public_url.rstrip('/')}/",
    )
    for to_email in recipients:
        try:
            await send_email(
                to_email=to_email,
                subject=email.subject,
                text_body=email.text_body,
                html_body=email.html_body,
                event="it_request.submitted",
            )
        except MailSendError:
            logger.exception("IT-request email failed for request %s", request.id)
