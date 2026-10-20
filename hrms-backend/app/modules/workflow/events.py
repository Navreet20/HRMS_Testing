"""Timeline events for timesheet / leave / requests — stored in activity_log (no WorkflowEvent table)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tables import ActivityLog

ITEM_TIMESHEET = "timesheet"
ITEM_LEAVE = "leave"
ITEM_PROFILE_UPDATE = "profile_update"
ITEM_ASSET_REQUEST = "asset_request"
ITEM_TYPES = frozenset(
    {ITEM_TIMESHEET, ITEM_LEAVE, ITEM_PROFILE_UPDATE, ITEM_ASSET_REQUEST}
)

EVENT_SUBMITTED = "submitted"
EVENT_RESUBMITTED = "resubmitted"
EVENT_RECALLED = "recalled"
EVENT_REOPENED = "reopened"
EVENT_APPROVED = "approved"
EVENT_REJECTED = "rejected"


def actor_of(user: dict[str, Any] | None) -> tuple[uuid.UUID | None, str | None]:
    """(employee id, display name) for whoever is acting."""
    if not user:
        return None, None
    try:
        employee_id = uuid.UUID(str(user.get("employeeId") or user.get("id")))
    except (TypeError, ValueError):
        employee_id = None
    name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
    return employee_id, (name or str(user.get("email") or "").strip() or None)


def record_event(
    session: AsyncSession,
    *,
    item_type: str,
    item_id: uuid.UUID,
    event: str,
    user: dict[str, Any] | None,
    comment: str | None = None,
) -> None:
    """Append one activity_log row (commits with the caller's transaction)."""
    employee_id, name = actor_of(user)
    text = (comment or "").strip()
    details: dict[str, Any] = {"event": event}
    if name:
        details["actorName"] = name[:200]
    if text:
        details["comment"] = text[:255]
    # write_log is async in some call sites — here we insert synchronously into the same session.
    session.add(
        ActivityLog(
            actor_employee_id=employee_id,
            action=event,
            entity_type=item_type,
            entity_id=item_id,
            details=details,
            occurred_at=datetime.now(timezone.utc),
        )
    )


def event_to_dict(row: ActivityLog) -> dict[str, Any]:
    details = row.details or {}
    return {
        "eventId": str(row.id),
        "event": row.action or details.get("event"),
        "actorName": details.get("actorName"),
        "comment": details.get("comment"),
        "createdDate": row.occurred_at.isoformat() if row.occurred_at else None,
    }


async def list_events(
    session: AsyncSession, item_type: str, item_id: uuid.UUID
) -> list[dict[str, Any]]:
    rows = (
        await session.execute(
            select(ActivityLog)
            .where(
                ActivityLog.entity_type == item_type,
                ActivityLog.entity_id == item_id,
            )
            .order_by(ActivityLog.occurred_at.asc())
        )
    ).scalars().all()
    return [event_to_dict(row) for row in rows]
