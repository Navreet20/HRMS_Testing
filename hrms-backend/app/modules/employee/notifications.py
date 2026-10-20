"""In-app notifications for employee profile updates (HR dashboard inbox)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tables import (Employee)
from app.models.awaiting import (InAppNotification)
from app.modules.org.service import resolve_org_master_company_id

NOTIFICATION_PROFILE_UPDATED = "PROFILE_UPDATED"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def notification_to_dict(row: InAppNotification) -> dict[str, Any]:
    return {
        "notificationId": str(row.notification_id),
        "type": row.type,
        "title": row.title,
        "body": row.body,
        "linkPath": row.link_path,
        "referenceId": str(row.reference_id) if row.reference_id else None,
        "isRead": row.is_read,
        "createdDate": row.created_date.isoformat() if row.created_date else None,
    }


def profile_updated_message(emp: Employee) -> str:
    name = f"{emp.first_name or ''} {emp.last_name or ''}".strip() or "An employee"
    display_id = (
        (getattr(emp, "business_employee_id", None) or "").strip()
        or (getattr(emp, "employee_code", None) or "").strip()
        or "—"
    )
    return f"{name} ({display_id}) has updated their profile."


async def notify_profile_updated(
    db: AsyncSession,
    actor: dict[str, Any],
    emp: Employee,
) -> None:
    """Queue an HR dashboard notification after an employee saves their profile."""
    company_id = await resolve_org_master_company_id(db, actor)
    message = profile_updated_message(emp)
    db.add(
        InAppNotification(
            company_id=company_id,
            type=NOTIFICATION_PROFILE_UPDATED,
            title=message,
            body=message,
            link_path="/employees",
            reference_id=emp.employee_id,
            is_read=False,
            created_date=_now(),
        )
    )
    await db.flush()


async def list_profile_notifications(
    db: AsyncSession,
    actor: dict[str, Any],
    *,
    unread_only: bool = False,
) -> dict[str, Any]:
    company_id = await resolve_org_master_company_id(db, actor)
    stmt = (
        select(InAppNotification)
        .where(
            InAppNotification.company_id == company_id,
            InAppNotification.type == NOTIFICATION_PROFILE_UPDATED,
        )
        .order_by(InAppNotification.created_date.desc())
    )
    if unread_only:
        stmt = stmt.where(InAppNotification.is_read.is_(False))
    result = await db.execute(stmt.limit(50))
    rows = [notification_to_dict(row) for row in result.scalars().all()]
    unread = await db.execute(
        select(func.count())
        .select_from(InAppNotification)
        .where(
            InAppNotification.company_id == company_id,
            InAppNotification.type == NOTIFICATION_PROFILE_UPDATED,
            InAppNotification.is_read.is_(False),
        )
    )
    return {
        "notifications": rows,
        "unreadCount": int(unread.scalar_one()),
    }


async def mark_profile_notification_read(
    db: AsyncSession,
    actor: dict[str, Any],
    notification_id: uuid.UUID,
) -> dict[str, Any]:
    company_id = await resolve_org_master_company_id(db, actor)
    result = await db.execute(
        select(InAppNotification).where(
            InAppNotification.notification_id == notification_id,
            InAppNotification.company_id == company_id,
            InAppNotification.type == NOTIFICATION_PROFILE_UPDATED,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    row.is_read = True
    await db.flush()
    return notification_to_dict(row)
