"""Soft-fail email when an asset is assigned to an employee."""

from __future__ import annotations

import html
import logging
from datetime import date

from app.core.config import get_settings
from app.mail.outbox import send_email
from app.mail.smtp import MailSendError
from app.models.tables import Asset, AssetCategory, Employee

logger = logging.getLogger(__name__)


def _display_name(employee: Employee) -> str:
    return f"{employee.first_name or ''} {employee.last_name or ''}".strip() or "there"


def _official_email(employee: Employee) -> str:
    return str(employee.email_id or "").strip()


def _is_deliverable_email(address: str) -> bool:
    if not address or "@" not in address:
        return False
    lower = address.lower()
    if lower.startswith("draft+") and lower.endswith("@hrms.local"):
        return False
    return True


def _dash(value: object | None) -> str:
    text = str(value).strip() if value is not None else ""
    return text or "—"


def _asset_identity_details(
    *,
    asset_id: str,
    category_name: str | None,
    model: str | None,
    serial_number: str | None,
) -> list[tuple[str, str]]:
    details = [
        ("Asset ID", asset_id),
        ("Category", _dash(category_name)),
        ("Model", _dash(model)),
    ]
    serial = str(serial_number).strip() if serial_number is not None else ""
    if serial:
        details.append(("Serial number", serial))
    return details


def build_assignment_email_bodies(
    *,
    employee_name: str,
    company: str,
    asset_id: str,
    category_name: str | None,
    model: str | None,
    serial_number: str | None,
    allocated_date: date,
    assigned_by: str | None,
    from_name: str,
    profile_assets_hint: str | None = None,
) -> tuple[str, str]:
    """Return ``(text_body, html_body)`` for an asset assignment notice."""
    details = _asset_identity_details(
        asset_id=asset_id,
        category_name=category_name,
        model=model,
        serial_number=serial_number,
    )
    details.extend(
        [
            ("Assigned on", allocated_date.isoformat()),
            ("Assigned by", _dash(assigned_by)),
        ]
    )

    text_lines = [
        f"Hi {employee_name},",
        "",
        f"{company} has assigned a company asset to you. This email confirms you "
        "now have the device. Please treat it as company property.",
        "",
        "Assignment details:",
    ]
    for label, value in details:
        text_lines.append(f"  • {label}: {value}")
    text_lines.extend(
        [
            "",
            "What to do next:",
            "  • Confirm the Asset ID on the physical sticker matches this email.",
            "  • Reach out to HR if anything looks wrong or the device is damaged.",
            "",
        ]
    )
    if profile_assets_hint:
        text_lines.append(profile_assets_hint)
        text_lines.append("")
    text_lines.extend(
        [
            "If you were not expecting this assignment, contact HR right away.",
            "",
            f"— {from_name}",
            "",
        ]
    )
    text_body = "\n".join(text_lines)

    safe_name = html.escape(employee_name)
    safe_company = html.escape(company)
    safe_from = html.escape(from_name)
    hint_html = (
        f"<p style=\"margin:16px 0 0;color:#374151;font-size:14px;\">"
        f"{html.escape(profile_assets_hint)}</p>"
        if profile_assets_hint
        else ""
    )
    html_body = (
        f'<div style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;'
        f'line-height:1.5;color:#111827;max-width:560px;">'
        f"<p>Hi {safe_name},</p>"
        f"<p>{safe_company} has assigned a company asset to you. This email "
        f"confirms you now have the device. Please treat it as company property.</p>"
        f"{_details_table_html(details)}"
        f"<p style=\"margin:16px 0 0;\"><strong>What to do next</strong></p>"
        f"<ul style=\"margin:8px 0 0;padding-left:18px;color:#374151;\">"
        f"<li>Confirm the Asset ID on the physical sticker matches this email.</li>"
        f"<li>Reach out to HR if anything looks wrong or the device is damaged.</li>"
        f"</ul>"
        f"{hint_html}"
        f"<p style=\"margin:16px 0 0;color:#6b7280;font-size:13px;\">"
        f"If you were not expecting this assignment, contact HR right away.</p>"
        f"<p style=\"margin:16px 0 0;\">— {safe_from}</p>"
        f"</div>"
    )
    return text_body, html_body


async def notify_asset_assigned(
    *,
    employee: Employee,
    asset: Asset,
    category: AssetCategory | None,
    allocated_date: date,
    assigned_by: str | None,
) -> None:
    """Email the employee about a new assignment. Never raises to the caller."""
    recipient = _official_email(employee)
    if not _is_deliverable_email(recipient):
        logger.info(
            "Skipping asset assignment email — employee has no deliverable official email"
        )
        return

    settings = get_settings()
    if not settings.smtp_enabled:
        logger.info("Skipping asset assignment email — SMTP_ENABLED is false")
        return

    company = (employee.company or settings.smtp_from_name or "EAOVA").strip() or "EAOVA"
    from_name = (settings.smtp_from_name or "EAOVA").strip() or "EAOVA"
    public = (settings.app_public_url or "").rstrip("/")
    profile_assets_hint = (
        "You'll see it under Profile → Assets"
        + (f" ({public})." if public else ".")
    )

    text_body, html_body = build_assignment_email_bodies(
        employee_name=_display_name(employee),
        company=company,
        asset_id=_dash(asset.asset_id),
        category_name=category.category_name if category else None,
        model=asset.model,
        serial_number=asset.serial_number,
        allocated_date=allocated_date,
        assigned_by=assigned_by,
        from_name=from_name,
        profile_assets_hint=profile_assets_hint,
    )
    subject = f"[{company}] Asset assigned to you — {_dash(asset.asset_id)}"
    try:
        await send_email(
            to_email=recipient,
            subject=subject,
            text_body=text_body,
            html_body=html_body,
            event="asset.assigned",
        )
    except MailSendError:
        logger.exception(
            "Failed to email employee about asset assignment (%s)",
            asset.asset_id,
        )


def _details_table_html(details: list[tuple[str, str]]) -> str:
    rows_html = "".join(
        (
            "<tr>"
            f'<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;'
            f'color:#6b7280;font-size:13px;width:40%;">{html.escape(label)}</td>'
            f'<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;'
            f'color:#111827;font-size:14px;font-weight:600;">{html.escape(value)}</td>'
            "</tr>"
        )
        for label, value in details
    )
    return (
        '<table role="presentation" cellpadding="0" cellspacing="0" '
        'style="width:100%;border-collapse:collapse;background:#f9fafb;'
        'border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">'
        f"{rows_html}"
        "</table>"
    )


def build_return_email_bodies(
    *,
    employee_name: str,
    company: str,
    asset_id: str,
    category_name: str | None,
    model: str | None,
    serial_number: str | None,
    reason: str,
    reason_other: str | None,
    condition_at_return: str,
    returned_date: date,
    returned_by: str | None,
    from_name: str,
) -> tuple[str, str]:
    """Return ``(text_body, html_body)`` for an asset return notice."""
    reason_display = reason
    if reason == "Other" and reason_other:
        reason_display = f"Other — {reason_other}"
    details = _asset_identity_details(
        asset_id=asset_id,
        category_name=category_name,
        model=model,
        serial_number=serial_number,
    )
    details.extend(
        [
            ("Return reason", reason_display),
            ("Condition at return", condition_at_return),
            ("Returned on", returned_date.isoformat()),
            ("Processed by", _dash(returned_by)),
        ]
    )

    text_lines = [
        f"Hi {employee_name},",
        "",
        f"{company} has recorded the return of a company asset previously assigned "
        "to you. You are no longer responsible for this device.",
        "",
        "Return details:",
    ]
    for label, value in details:
        text_lines.append(f"  • {label}: {value}")
    text_lines.extend(
        [
            "",
            "If you still have this device, or this return looks incorrect, contact HR.",
            "",
            f"— {from_name}",
            "",
        ]
    )
    text_body = "\n".join(text_lines)

    safe_name = html.escape(employee_name)
    safe_company = html.escape(company)
    safe_from = html.escape(from_name)
    html_body = (
        f'<div style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;'
        f'line-height:1.5;color:#111827;max-width:560px;">'
        f"<p>Hi {safe_name},</p>"
        f"<p>{safe_company} has recorded the return of a company asset previously "
        f"assigned to you. You are no longer responsible for this device.</p>"
        f"{_details_table_html(details)}"
        f'<p style="margin:16px 0 0;color:#6b7280;font-size:13px;">'
        f"If you still have this device, or this return looks incorrect, contact HR.</p>"
        f'<p style="margin:16px 0 0;">— {safe_from}</p>'
        f"</div>"
    )
    return text_body, html_body


async def notify_asset_returned(
    *,
    employee: Employee,
    asset: Asset,
    category: AssetCategory | None,
    reason: str,
    reason_other: str | None,
    condition_at_return: str,
    returned_date: date,
    returned_by: str | None,
) -> None:
    """Email the employee about a recorded return. Never raises to the caller."""
    recipient = _official_email(employee)
    if not _is_deliverable_email(recipient):
        logger.info(
            "Skipping asset return email — employee has no deliverable official email"
        )
        return

    settings = get_settings()
    if not settings.smtp_enabled:
        logger.info("Skipping asset return email — SMTP_ENABLED is false")
        return

    company = (employee.company or settings.smtp_from_name or "EAOVA").strip() or "EAOVA"
    from_name = (settings.smtp_from_name or "EAOVA").strip() or "EAOVA"

    text_body, html_body = build_return_email_bodies(
        employee_name=_display_name(employee),
        company=company,
        asset_id=_dash(asset.asset_id),
        category_name=category.category_name if category else None,
        model=asset.model,
        serial_number=asset.serial_number,
        reason=reason,
        reason_other=reason_other,
        condition_at_return=condition_at_return,
        returned_date=returned_date,
        returned_by=returned_by,
        from_name=from_name,
    )
    subject = f"[{company}] Asset return recorded — {_dash(asset.asset_id)}"
    try:
        await send_email(
            to_email=recipient,
            subject=subject,
            text_body=text_body,
            html_body=html_body,
            event="asset.returned",
        )
    except MailSendError:
        logger.exception(
            "Failed to email employee about asset return (%s)",
            asset.asset_id,
        )


async def notify_asset_lost_or_found(
    *,
    kind: str,
    asset: Asset,
    category: AssetCategory | None,
    employee: Employee | None,
    detail: str,
    notes: str | None,
    recorded_by: str | None,
) -> None:
    """Tell the person who held the asset and the asset managers. Never raises."""
    from app.mail.recipients import notification_recipients
    from app.mail.templates import render

    try:
        recipients = await notification_recipients("assets")
    except Exception:  # noqa: BLE001 - a mail lookup must not undo the asset change
        logger.exception("Could not look up asset managers for %s email", kind)
        recipients = []
    # The person who held it hears at their work address and their personal one.
    for address in reversed(
        [
            _official_email(employee) if employee is not None else "",
            str(getattr(employee, "personal_email", "") or "").strip() if employee is not None else "",
        ]
    ):
        if _is_deliverable_email(address) and address.lower() not in recipients:
            recipients = [address.lower(), *recipients]
    if not recipients:
        return
    if not get_settings().smtp_enabled:
        logger.info("Skipping asset %s email — SMTP_ENABLED is false", kind)
        return

    email = render(
        "asset.lost" if kind == "lost" else "asset.found",
        asset_id=_dash(asset.asset_id),
        category=_dash(category.category_name if category else None),
        model=_dash(asset.model),
        employee_name=_display_name(employee) if employee is not None else "—",
        detail=detail,
        notes=_dash(notes),
        recorded_by=_dash(recorded_by),
    )
    for to_email in recipients:
        try:
            await send_email(
                to_email=to_email,
                subject=email.subject,
                text_body=email.text_body,
                html_body=email.html_body,
                event=f"asset.{kind}",
            )
        except MailSendError:
            logger.exception("Failed to send asset %s email (%s)", kind, asset.asset_id)


def build_swap_email_bodies(
    *,
    employee_name: str,
    company: str,
    old_details: list[tuple[str, str]],
    new_details: list[tuple[str, str]],
    reason: str,
    condition_at_return: str,
    swapped_on: date,
    processed_by: str | None,
    from_name: str,
) -> tuple[str, str]:
    """Return ``(text_body, html_body)`` for one notice covering a swap."""
    old_rows = [
        *old_details,
        ("Return reason", reason),
        ("Condition at return", condition_at_return),
    ]
    new_rows = [*new_details, ("Swapped on", swapped_on.isoformat()), ("Processed by", _dash(processed_by))]

    text_lines = [
        f"Hi {employee_name},",
        "",
        f"{company} has swapped a company asset for you. The old device is returned and "
        "the new one is now yours. Please treat it as company property.",
        "",
        "Returned:",
    ]
    text_lines.extend(f"  • {label}: {value}" for label, value in old_rows)
    text_lines.extend(["", "New asset:"])
    text_lines.extend(f"  • {label}: {value}" for label, value in new_rows)
    text_lines.extend(
        [
            "",
            "Confirm the Asset ID on the new device's sticker matches this email, "
            "and contact HR if anything looks wrong.",
            "",
            f"— {from_name}",
            "",
        ]
    )
    text_body = "\n".join(text_lines)

    html_body = (
        f'<div style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;'
        f'line-height:1.5;color:#111827;max-width:560px;">'
        f"<p>Hi {html.escape(employee_name)},</p>"
        f"<p>{html.escape(company)} has swapped a company asset for you. The old device "
        f"is returned and the new one is now yours. Please treat it as company property.</p>"
        f'<p style="margin:16px 0 6px;"><strong>Returned</strong></p>'
        f"{_details_table_html(old_rows)}"
        f'<p style="margin:16px 0 6px;"><strong>New asset</strong></p>'
        f"{_details_table_html(new_rows)}"
        f'<p style="margin:16px 0 0;color:#6b7280;font-size:13px;">'
        f"Confirm the Asset ID on the new device's sticker matches this email, and "
        f"contact HR if anything looks wrong.</p>"
        f'<p style="margin:16px 0 0;">— {html.escape(from_name)}</p>'
        f"</div>"
    )
    return text_body, html_body


async def notify_asset_swapped(
    *,
    employee: Employee,
    old_asset: Asset,
    old_category: AssetCategory | None,
    new_asset: Asset,
    new_category: AssetCategory | None,
    reason: str,
    reason_other: str | None,
    condition_at_return: str,
    swapped_on: date,
    processed_by: str | None,
) -> None:
    """One email to the employee for a whole swap (not one per asset). Never raises."""
    recipient = _official_email(employee)
    if not _is_deliverable_email(recipient):
        logger.info("Skipping asset swap email - employee has no deliverable official email")
        return
    settings = get_settings()
    if not settings.smtp_enabled:
        logger.info("Skipping asset swap email - SMTP_ENABLED is false")
        return

    company = (employee.company or settings.smtp_from_name or "EAOVA").strip() or "EAOVA"
    from_name = (settings.smtp_from_name or "EAOVA").strip() or "EAOVA"
    reason_display = f"Other - {reason_other}" if reason == "Other" and reason_other else reason
    text_body, html_body = build_swap_email_bodies(
        employee_name=_display_name(employee),
        company=company,
        old_details=_asset_identity_details(
            asset_id=_dash(old_asset.asset_id),
            category_name=old_category.category_name if old_category else None,
            model=old_asset.model,
            serial_number=old_asset.serial_number,
        ),
        new_details=_asset_identity_details(
            asset_id=_dash(new_asset.asset_id),
            category_name=new_category.category_name if new_category else None,
            model=new_asset.model,
            serial_number=new_asset.serial_number,
        ),
        reason=reason_display,
        condition_at_return=condition_at_return,
        swapped_on=swapped_on,
        processed_by=processed_by,
        from_name=from_name,
    )
    try:
        await send_email(
            to_email=recipient,
            subject=f"[{company}] Asset swapped - {_dash(old_asset.asset_id)} to {_dash(new_asset.asset_id)}",
            text_body=text_body,
            html_body=html_body,
            event="asset.swapped",
        )
    except MailSendError:
        logger.exception(
            "Failed to email employee about asset swap (%s to %s)",
            old_asset.asset_id,
            new_asset.asset_id,
        )
