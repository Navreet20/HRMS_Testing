"""Notification email queue (outbox) and the background worker that sends it.

Notification code calls ``send_email`` here: the email is saved to the
``NOTIFICATION_OUTBOX`` table and the request carries on, so a slow or failing
mail server never slows down or breaks the action. A background worker in the
API process sends due emails through the configured provider and retries
failures (1 min, 5 min, 15 min, 1 h, 6 h), then marks them ``failed``.

Several backends can share one database (each developer runs one), so the
worker locks the rows it sends (``FOR UPDATE SKIP LOCKED``) and no email goes
out twice. The employee invite does not use this queue: it is sent at once so
HR sees a delivery failure straight away.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select

from app.core.config import get_settings
from app.db.session import async_session_maker
from app.mail.providers import deliver_email
from app.mail.smtp import MailSendError
from app.models.awaiting import (NotificationOutbox)

logger = logging.getLogger(__name__)

STATUS_PENDING = "pending"
STATUS_SENT = "sent"
STATUS_FAILED = "failed"
RETRY_DELAYS_SECONDS: tuple[int, ...] = (60, 300, 900, 3600, 21600)
BATCH_SIZE = 20

# Set while the worker runs, so a newly queued email wakes it at once instead of
# the worker polling the database (which would keep a serverless database awake).
_wake: asyncio.Event | None = None


def wake_worker() -> None:
    """Tell this process's worker that an email was queued."""
    if _wake is not None:
        _wake.set()


def _now() -> datetime:
    return datetime.now(UTC)


async def send_email(
    *,
    to_email: str,
    subject: str,
    text_body: str,
    html_body: str | None = None,
    event: str | None = None,
) -> None:
    """Queue one notification email. Raises MailSendError if it cannot be queued."""
    recipient = (to_email or "").strip()
    if not recipient or "@" not in recipient:
        raise MailSendError("A valid email address is required.")
    now = _now()
    try:
        async with async_session_maker() as db:
            db.add(
                NotificationOutbox(
                    event=(event or None) and event[:64],
                    to_email=recipient,
                    subject=subject[:500],
                    text_body=text_body,
                    html_body=html_body,
                    status=STATUS_PENDING,
                    attempts=0,
                    created_at=now,
                    next_attempt_at=now,
                )
            )
            await db.commit()
    except Exception as exc:  # database unavailable, etc.
        logger.exception("Could not queue notification email to %s", recipient)
        raise MailSendError("Could not queue the email.") from exc
    wake_worker()


def _record_failure(row: NotificationOutbox, error: str, now: datetime) -> None:
    row.attempts += 1
    row.last_error = error[:500]
    if row.attempts > len(RETRY_DELAYS_SECONDS):
        row.status = STATUS_FAILED
        logger.warning("Notification email to %s failed for good: %s", row.to_email, error)
        return
    row.next_attempt_at = now + timedelta(seconds=RETRY_DELAYS_SECONDS[row.attempts - 1])


async def deliver_due(limit: int = BATCH_SIZE) -> int:
    """Send queued emails that are due. Returns how many were attempted."""
    async with async_session_maker() as db:
        rows = (
            await db.execute(
                select(NotificationOutbox)
                .where(
                    NotificationOutbox.status == STATUS_PENDING,
                    NotificationOutbox.next_attempt_at <= _now(),
                )
                .order_by(NotificationOutbox.created_at)
                .limit(limit)
                .with_for_update(skip_locked=True)
            )
        ).scalars().all()
        for row in rows:
            try:
                await deliver_email(
                    to_email=row.to_email,
                    subject=row.subject,
                    text_body=row.text_body,
                    html_body=row.html_body,
                )
            except MailSendError as exc:
                _record_failure(row, str(exc), _now())
            except Exception as exc:  # never let one email stop the batch
                logger.exception("Unexpected error sending notification %s", row.id)
                _record_failure(row, type(exc).__name__, _now())
            else:
                row.status = STATUS_SENT
                row.sent_at = _now()
                row.last_error = None
        await db.commit()
        return len(rows)


async def _seconds_until_next_attempt() -> float | None:
    """How long until the earliest waiting email is due (None if nothing waits)."""
    async with async_session_maker() as db:
        due = (
            await db.execute(
                select(func.min(NotificationOutbox.next_attempt_at)).where(
                    NotificationOutbox.status == STATUS_PENDING
                )
            )
        ).scalar_one_or_none()
    if due is None:
        return None
    return max(0.0, (due - _now()).total_seconds())


async def run_worker(stop: asyncio.Event) -> None:
    """Send due emails, then sleep until one is queued or a retry comes due.

    Nothing polls while the queue is quiet: a serverless database (Neon) only
    scales to zero when it is left alone, and a poll every few seconds would
    keep it, and its billed compute hours, running all day. Emails queued by
    this process wake the worker at once; retries set their own alarm; one pass
    at start-up catches anything left over. ``NOTIFICATION_POLL_SECONDS`` (0 =
    off) adds a slow safety poll for setups that want one.
    """
    global _wake
    _wake = asyncio.Event()
    safety_poll = max(0, int(get_settings().notification_poll_seconds))
    try:
        while not stop.is_set():
            try:
                sent = await deliver_due()
            except Exception:
                logger.exception("Notification worker pass failed; retrying later")
                sent = 0
            if sent >= BATCH_SIZE:
                continue  # more may be waiting
            try:
                delay = await _seconds_until_next_attempt()
            except Exception:
                logger.exception("Could not look up the next email retry")
                delay = None
            timeouts = [t for t in (delay, safety_poll or None) if t is not None]
            timeout = min(timeouts) if timeouts else None
            _wake.clear()
            waiters = {
                asyncio.ensure_future(stop.wait()),
                asyncio.ensure_future(_wake.wait()),
            }
            try:
                await asyncio.wait(waiters, timeout=timeout, return_when=asyncio.FIRST_COMPLETED)
            finally:
                for waiter in waiters:
                    waiter.cancel()
    finally:
        _wake = None
