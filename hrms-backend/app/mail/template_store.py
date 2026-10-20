"""Loads edited email wording from the database into ``app.mail.templates``.

Emails are rendered synchronously where the event happens, so the edited wording
is cached in memory: loaded at startup, refreshed every minute (so every backend
process picks up an edit made on another one) and right after each save.
"""

from __future__ import annotations

import asyncio
import logging

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import async_session_maker
from app.mail.templates import TEMPLATES, set_overrides
from app.models.awaiting import (NotificationTemplate)

logger = logging.getLogger(__name__)



async def load_overrides(db: AsyncSession) -> dict[str, tuple[str, str]]:
    """Edited wording by template key; rows for emails that no longer exist are ignored."""
    rows = (await db.execute(select(NotificationTemplate))).scalars().all()
    return {row.template_key: (row.subject, row.body) for row in rows if row.template_key in TEMPLATES}


async def refresh_overrides() -> None:
    try:
        async with async_session_maker() as db:
            set_overrides(await load_overrides(db))
    except HTTPException:
        # notification_templates has no table in the 37-table schema: the built-in wording is used.
        return
    except Exception:
        logger.exception("Could not refresh edited email wording; keeping what is loaded")


async def run_refresher(stop: asyncio.Event) -> None:
    """Load the edited wording at start-up, then again after each save.

    Saving refreshes this process straight away. Re-reading on a timer is off by
    default because a serverless database (Neon) stays awake, and keeps billing
    compute hours, if something touches it every minute. Set
    ``TEMPLATE_REFRESH_SECONDS`` (for example 60) when several backends share
    one database so an edit made on one reaches the others.
    """
    await refresh_overrides()
    interval = max(0, int(get_settings().template_refresh_seconds))
    while not stop.is_set():
        try:
            await asyncio.wait_for(stop.wait(), timeout=interval or None)
        except TimeoutError:
            await refresh_overrides()
