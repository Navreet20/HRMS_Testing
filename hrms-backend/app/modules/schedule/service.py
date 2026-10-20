from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.awaiting import (ScheduleEvent)

ALLOWED_KINDS = frozenset({"meeting", "deadline", "leave", "reminder"})


def schedule_event_to_dict(event: ScheduleEvent) -> dict[str, Any]:
    return {
        "id": str(event.id),
        "title": event.title,
        "date": event.event_date,
        "startTime": event.start_time,
        "endTime": event.end_time,
        "kind": event.kind,
    }


async def list_events(db: AsyncSession) -> list[dict]:
    result = await db.execute(select(ScheduleEvent).order_by(ScheduleEvent.event_date, ScheduleEvent.start_time))
    return [schedule_event_to_dict(row) for row in result.scalars().all()]


async def get_event(db: AsyncSession, event_id: uuid.UUID) -> dict:
    result = await db.execute(select(ScheduleEvent).where(ScheduleEvent.id == event_id))
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule event not found")
    return schedule_event_to_dict(event)


def _validate_kind(kind: str) -> str:
    if kind not in ALLOWED_KINDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"kind must be one of: {', '.join(sorted(ALLOWED_KINDS))}",
        )
    return kind


async def create_event(db: AsyncSession, actor: dict, payload: dict[str, Any]) -> dict:
    title = str(payload.get("title") or "").strip()
    event_date = str(payload.get("date") or "").strip()
    start_time = str(payload.get("startTime") or "").strip()
    if not title or not event_date or not start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="title, date, and startTime are required",
        )
    kind = _validate_kind(str(payload.get("kind") or "meeting").strip())
    end_raw = payload.get("endTime")
    end_time = str(end_raw).strip() if end_raw else None
    actor_name = f"{actor.get('firstName', '')} {actor.get('lastName', '')}".strip() or None
    now = datetime.utcnow()
    event = ScheduleEvent(
        title=title,
        event_date=event_date,
        start_time=start_time,
        end_time=end_time or None,
        kind=kind,
        created_by=actor_name,
        updated_by=actor_name,
        created_date=now,
        updated_date=now,
    )
    db.add(event)
    await db.flush()
    return schedule_event_to_dict(event)


async def update_event(
    db: AsyncSession,
    actor: dict,
    event_id: uuid.UUID,
    payload: dict[str, Any],
) -> dict:
    result = await db.execute(select(ScheduleEvent).where(ScheduleEvent.id == event_id))
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule event not found")
    if payload.get("title") is not None:
        title = str(payload["title"]).strip()
        if not title:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="title cannot be empty")
        event.title = title
    if payload.get("date") is not None:
        event_date = str(payload["date"]).strip()
        if not event_date:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="date cannot be empty")
        event.event_date = event_date
    if payload.get("startTime") is not None:
        start_time = str(payload["startTime"]).strip()
        if not start_time:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="startTime cannot be empty")
        event.start_time = start_time
    if "endTime" in payload:
        end_raw = payload.get("endTime")
        event.end_time = str(end_raw).strip() if end_raw else None
    if payload.get("kind") is not None:
        event.kind = _validate_kind(str(payload["kind"]).strip())
    event.updated_by = f"{actor.get('firstName', '')} {actor.get('lastName', '')}".strip() or None
    event.updated_date = datetime.utcnow()
    await db.flush()
    return schedule_event_to_dict(event)


async def delete_event(db: AsyncSession, event_id: uuid.UUID) -> dict:
    result = await db.execute(select(ScheduleEvent).where(ScheduleEvent.id == event_id))
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule event not found")
    payload = schedule_event_to_dict(event)
    await db.delete(event)
    await db.flush()
    return payload
