"""Notification email queue: queueing, delivery, retries and the provider switch."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.mail import outbox
from app.mail.providers import deliver_email
from app.mail.smtp import MailSendError


class _Session:
    """Minimal async session for the outbox (add / commit / execute)."""

    def __init__(self, rows=()):
        self.added = []
        self.committed = False
        result = MagicMock()
        result.scalars.return_value.all.return_value = list(rows)
        self.execute = AsyncMock(return_value=result)

    def add(self, row):
        self.added.append(row)

    async def commit(self):
        self.committed = True

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_exc):
        return False


def _row(**fields):
    base = {
        "id": "r1",
        "to_email": "hr@arohak.com",
        "subject": "Leave request",
        "text_body": "Hi",
        "html_body": None,
        "status": outbox.STATUS_PENDING,
        "attempts": 0,
        "last_error": None,
        "next_attempt_at": datetime.now(UTC),
        "sent_at": None,
    }
    base.update(fields)
    return SimpleNamespace(**base)


@pytest.mark.asyncio
async def test_send_email_queues_instead_of_sending() -> None:
    session = _Session()
    deliver = AsyncMock()
    with (
        patch("app.mail.outbox.async_session_maker", return_value=session),
        patch("app.mail.outbox.deliver_email", deliver),
    ):
        await outbox.send_email(
            to_email=" hr@arohak.com ", subject="Leave request", text_body="Hi", event="leave.submitted"
        )
    assert session.committed
    queued = session.added[0]
    assert (queued.to_email, queued.status, queued.attempts) == ("hr@arohak.com", "pending", 0)
    assert queued.event == "leave.submitted"
    deliver.assert_not_awaited()


@pytest.mark.asyncio
async def test_send_email_rejects_blank_recipient() -> None:
    with pytest.raises(MailSendError):
        await outbox.send_email(to_email="  ", subject="x", text_body="y")


@pytest.mark.asyncio
async def test_send_email_raises_mail_error_when_queue_unavailable() -> None:
    with patch("app.mail.outbox.async_session_maker", side_effect=RuntimeError("db down")):
        with pytest.raises(MailSendError):
            await outbox.send_email(to_email="hr@arohak.com", subject="x", text_body="y")


@pytest.mark.asyncio
async def test_worker_marks_delivered_email_sent() -> None:
    row = _row()
    session = _Session([row])
    deliver = AsyncMock()
    with (
        patch("app.mail.outbox.async_session_maker", return_value=session),
        patch("app.mail.outbox.deliver_email", deliver),
    ):
        assert await outbox.deliver_due() == 1
    deliver.assert_awaited_once()
    assert row.status == outbox.STATUS_SENT
    assert row.sent_at is not None
    assert session.committed


@pytest.mark.asyncio
async def test_worker_retries_with_backoff_then_gives_up() -> None:
    row = _row()
    session = _Session([row])
    deliver = AsyncMock(side_effect=MailSendError("SMTP down"))
    with (
        patch("app.mail.outbox.async_session_maker", return_value=session),
        patch("app.mail.outbox.deliver_email", deliver),
    ):
        before = datetime.now(UTC)
        await outbox.deliver_due()
        assert row.status == outbox.STATUS_PENDING
        assert row.attempts == 1
        assert row.last_error == "SMTP down"
        assert row.next_attempt_at >= before + timedelta(seconds=59)

        row.attempts = len(outbox.RETRY_DELAYS_SECONDS)
        await outbox.deliver_due()
    assert row.status == outbox.STATUS_FAILED


@pytest.mark.asyncio
async def test_one_bad_email_does_not_stop_the_batch() -> None:
    bad, good = _row(id="bad"), _row(id="good")
    session = _Session([bad, good])
    deliver = AsyncMock(side_effect=[RuntimeError("boom"), None])
    with (
        patch("app.mail.outbox.async_session_maker", return_value=session),
        patch("app.mail.outbox.deliver_email", deliver),
    ):
        await outbox.deliver_due()
    assert bad.status == outbox.STATUS_PENDING and bad.attempts == 1
    assert good.status == outbox.STATUS_SENT


@pytest.mark.asyncio
async def test_provider_smtp_uses_smtp_settings() -> None:
    smtp_send = AsyncMock()
    with (
        patch("app.mail.providers.get_settings", return_value=SimpleNamespace(email_provider="smtp")),
        patch("app.mail.providers.smtp.send_email", smtp_send),
    ):
        await deliver_email(to_email="a@x.com", subject="s", text_body="t")
    smtp_send.assert_awaited_once()


@pytest.mark.asyncio
async def test_unknown_provider_is_a_mail_error() -> None:
    with patch("app.mail.providers.get_settings", return_value=SimpleNamespace(email_provider="pigeon")):
        with pytest.raises(MailSendError):
            await deliver_email(to_email="a@x.com", subject="s", text_body="t")


# --- the worker must not poll a quiet database -------------------------------


@pytest.mark.asyncio
async def test_worker_sleeps_until_an_email_is_queued_instead_of_polling() -> None:
    import asyncio
    from unittest.mock import AsyncMock, patch

    from app.mail import outbox

    stop = asyncio.Event()
    passes = 0

    async def fake_deliver() -> int:
        nonlocal passes
        passes += 1
        return 0

    with patch.object(outbox, "deliver_due", fake_deliver), patch.object(
        outbox, "_seconds_until_next_attempt", AsyncMock(return_value=None)
    ):
        task = asyncio.create_task(outbox.run_worker(stop))
        await asyncio.sleep(0.3)
        assert passes == 1  # start-up pass only; nothing polls while it is quiet
        await asyncio.sleep(0.3)
        assert passes == 1

        outbox.wake_worker()  # what send_email does after queueing
        await asyncio.sleep(0.2)
        assert passes == 2

        stop.set()
        await asyncio.wait_for(task, timeout=2)
    assert outbox._wake is None


@pytest.mark.asyncio
async def test_worker_wakes_by_itself_when_a_retry_comes_due() -> None:
    import asyncio
    from unittest.mock import AsyncMock, patch

    from app.mail import outbox

    stop = asyncio.Event()
    passes = 0

    async def fake_deliver() -> int:
        nonlocal passes
        passes += 1
        return 0

    with patch.object(outbox, "deliver_due", fake_deliver), patch.object(
        outbox, "_seconds_until_next_attempt", AsyncMock(return_value=0.2)
    ):
        task = asyncio.create_task(outbox.run_worker(stop))
        await asyncio.sleep(0.7)
        assert passes >= 3  # start-up, then each time the retry alarm rings
        stop.set()
        await asyncio.wait_for(task, timeout=2)


@pytest.mark.asyncio
async def test_template_refresher_only_reads_at_start_and_never_polls_by_default() -> None:
    import asyncio
    from unittest.mock import AsyncMock, patch

    from app.mail import template_store

    stop = asyncio.Event()
    refresh = AsyncMock()
    with patch.object(template_store, "refresh_overrides", refresh):
        task = asyncio.create_task(template_store.run_refresher(stop))
        await asyncio.sleep(0.3)
        assert refresh.await_count == 1
        stop.set()
        await asyncio.wait_for(task, timeout=2)
