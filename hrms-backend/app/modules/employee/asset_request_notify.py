"""ESS-DATA-3: email Asset Manager (HR today) when an employee submits an asset request."""

from __future__ import annotations

import logging

from app.core.config import get_settings
from app.mail.outbox import send_email
from app.mail.recipients import notification_recipients
from app.mail.smtp import MailSendError
from app.mail.templates import render
from app.models.tables import (Employee)
from app.models.tables import AssetRequest

logger = logging.getLogger(__name__)

_REQUEST_TYPE_LABELS = {
    "new": "New",
    "swap": "Swap",
    "reportLostStolen": "Report Lost/Stolen",
}


async def notify_asset_manager_asset_request(
    *,
    employee: Employee,
    request: AssetRequest,
    asset_code: str | None = None,
    category_name: str | None = None,
) -> None:
    # Everyone with Assets full access (then Admins, Superadmins).
    recipients = await notification_recipients("assets")
    if not recipients:
        logger.info("Skipping asset-request email — no one to notify")
        return
    settings = get_settings()
    if not settings.smtp_enabled:
        logger.info("Skipping asset-request email — SMTP_ENABLED is false")
        return

    email = render(
        "asset_request.submitted",
        employee_name=f"{employee.first_name or ''} {employee.last_name or ''}".strip()
        or "Employee",
        employee_code=(employee.business_employee_id or employee.employee_code or "").strip()
        or "—",
        work_email=(employee.email_id or "").strip() or "—",
        request_type=_REQUEST_TYPE_LABELS.get(request.request_type, request.request_type),
        category=(category_name or "").strip() or "—",
        asset=(asset_code or "").strip()
        or (str(request.system_asset_id) if request.system_asset_id else "—"),
        details=(request.new_asset_details or "").strip() or "—",
        request_id=request.id,
        assets_url=f"{settings.app_public_url.rstrip('/')}/assets",
    )
    for to_email in recipients:
        try:
            await send_email(
                to_email=to_email,
                subject=email.subject,
                text_body=email.text_body,
                html_body=email.html_body,
                event="asset_request.submitted",
            )
        except MailSendError:
            logger.exception("Asset-request email failed for request %s", request.id)
