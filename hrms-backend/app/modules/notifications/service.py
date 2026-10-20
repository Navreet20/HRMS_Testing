"""Company Setup → Notifications: the email delivery log and the template catalog."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.mail.outbox import STATUS_FAILED, STATUS_PENDING, STATUS_SENT, send_email as queue_email
from app.mail.smtp import MailSendError
from app.mail.template_store import load_overrides
from app.mail.templates import (
    TEMPLATES,
    TemplateError,
    effective_wording,
    render,
    render_wording,
    sample_values,
    set_overrides,
    validate_wording,
)
from app.models.awaiting import (NotificationOutbox, NotificationTemplate)

DELIVERY_STATUSES = (STATUS_PENDING, STATUS_SENT, STATUS_FAILED)
MAX_PAGE_SIZE = 100


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _delivery_to_dict(row: NotificationOutbox) -> dict[str, Any]:
    template = TEMPLATES.get(row.event or "")
    return {
        "id": str(row.id),
        "event": row.event,
        "eventName": template.name if template else (row.event or "Email"),
        "toEmail": row.to_email,
        "subject": row.subject,
        "status": row.status,
        "attempts": row.attempts,
        "lastError": row.last_error,
        "createdAt": _iso(row.created_at),
        "nextAttemptAt": _iso(row.next_attempt_at) if row.status == STATUS_PENDING else None,
        "sentAt": _iso(row.sent_at),
    }


async def list_deliveries(
    db: AsyncSession,
    *,
    status_filter: str | None,
    search: str | None,
    page: int,
    page_size: int,
) -> dict[str, Any]:
    """Newest first; filter by status and by recipient or subject text."""
    size = max(1, min(page_size, MAX_PAGE_SIZE))
    filters = []
    if status_filter:
        if status_filter not in DELIVERY_STATUSES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown status")
        filters.append(NotificationOutbox.status == status_filter)
    needle = (search or "").strip().lower()
    if needle:
        like = f"%{needle}%"
        filters.append(
            func.lower(NotificationOutbox.to_email).like(like)
            | func.lower(NotificationOutbox.subject).like(like)
        )
    total = (
        await db.execute(select(func.count()).select_from(NotificationOutbox).where(*filters))
    ).scalar_one()
    counts = dict(
        (
            await db.execute(
                select(NotificationOutbox.status, func.count()).group_by(NotificationOutbox.status)
            )
        ).all()
    )
    rows = (
        await db.execute(
            select(NotificationOutbox)
            .where(*filters)
            .order_by(NotificationOutbox.created_at.desc())
            .offset(max(0, page) * size)
            .limit(size)
        )
    ).scalars().all()
    return {
        "items": [_delivery_to_dict(row) for row in rows],
        "total": int(total),
        "page": max(0, page),
        "pageSize": size,
        "counts": {name: int(counts.get(name, 0)) for name in DELIVERY_STATUSES},
    }


WITHDRAWN_ERROR = "Withdrawn"


async def withdraw_delivery(db: AsyncSession, delivery_id: uuid.UUID) -> dict[str, Any]:
    """Stop a waiting email. It stays in the log and is not sent."""
    row = await db.get(NotificationOutbox, delivery_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found")
    if row.status == STATUS_SENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="This email was already sent"
        )
    if row.status != STATUS_PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Only a waiting email can be withdrawn"
        )
    row.status = STATUS_FAILED
    row.last_error = WITHDRAWN_ERROR
    await db.flush()
    return _delivery_to_dict(row)


async def retry_delivery(db: AsyncSession, delivery_id: uuid.UUID) -> dict[str, Any]:
    """Queue a failed (or waiting) email to be sent again now, with fresh retries."""
    row = await db.get(NotificationOutbox, delivery_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found")
    if row.status == STATUS_SENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="This email was already sent"
        )
    row.status = STATUS_PENDING
    row.attempts = 0
    row.next_attempt_at = datetime.now(UTC)
    await db.flush()
    return _delivery_to_dict(row)


def _template_to_dict(key: str, row: NotificationTemplate | None) -> dict[str, Any]:
    template = TEMPLATES[key]
    subject, body = effective_wording(key) if row is None else (row.subject, row.body)
    return {
        "key": template.key,
        "name": template.name,
        "description": template.description,
        "recipients": template.recipients,
        "placeholders": list(template.placeholders),
        "subject": subject if template.editable else None,
        "body": body if template.editable else None,
        "defaultSubject": template.subject if template.editable else None,
        "defaultBody": template.body if template.editable else None,
        "customized": row is not None,
        "updatedBy": row.updated_by if row is not None else None,
        "updatedDate": _iso(row.updated_date) if row is not None else None,
        "editable": template.editable,
    }


def _template_key(key: str) -> str:
    if key not in TEMPLATES:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found")
    return key


async def _reload(db: AsyncSession) -> None:
    await db.flush()
    set_overrides(await load_overrides(db))


async def list_templates(db: AsyncSession) -> list[dict[str, Any]]:
    """Every notification email with its current wording, who receives it and whether it was edited."""
    rows = {
        row.template_key: row
        for row in (await db.execute(select(NotificationTemplate))).scalars().all()
    }
    return [_template_to_dict(key, rows.get(key)) for key in TEMPLATES]


async def save_template(
    db: AsyncSession, actor: dict[str, Any], key: str, subject: str, body: str
) -> dict[str, Any]:
    _template_key(key)
    try:
        subject, body = validate_wording(key, subject, body)
    except TemplateError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    name = f"{actor.get('firstName', '')} {actor.get('lastName', '')}".strip() or None
    row = await db.get(NotificationTemplate, key)
    now = datetime.now(UTC)
    if row is None:
        row = NotificationTemplate(
            template_key=key, subject=subject, body=body, updated_by=name, updated_date=now
        )
        db.add(row)
    else:
        row.subject, row.body, row.updated_by, row.updated_date = subject, body, name, now
    await _reload(db)
    return _template_to_dict(key, row)


async def reset_template(db: AsyncSession, key: str) -> dict[str, Any]:
    """Go back to the built-in wording."""
    _template_key(key)
    row = await db.get(NotificationTemplate, key)
    if row is not None:
        await db.delete(row)
    await _reload(db)
    return _template_to_dict(key, None)


async def send_test_email(key: str, to_email: str) -> dict[str, str]:
    """Queue one sample of a template. Automatic sends are unchanged.

    Wording is the saved (or built-in) text with example names and dates.
    Fixed-layout emails are built by their own action and cannot be sampled here.
    """
    _template_key(key)
    template = TEMPLATES[key]
    if not template.editable:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This email has a fixed layout and is sent by its own action.",
        )
    recipient = (to_email or "").strip()
    if "@" not in recipient or recipient.startswith("@") or recipient.endswith("@"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid email address is required.",
        )
    email = render(key, **sample_values(key, get_settings().app_public_url))
    try:
        await queue_email(
            to_email=recipient,
            subject=email.subject,
            text_body=email.text_body,
            html_body=email.html_body,
            event=key,
        )
    except MailSendError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {"toEmail": recipient, "subject": email.subject}


def preview_template(key: str, subject: str, body: str) -> dict[str, str]:
    """How the (unsaved) wording looks with example values."""
    _template_key(key)
    try:
        subject, body = validate_wording(key, subject, body)
    except TemplateError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    email = render_wording(key, subject, body, **sample_values(key, get_settings().app_public_url))
    return {"subject": email.subject, "body": email.text_body}
