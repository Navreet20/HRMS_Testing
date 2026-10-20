"""Company Setup → Notifications: delivery log, retry and template catalog."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.modules.notifications import service as svc


def _row(**fields):
    base = {
        "id": uuid.uuid4(),
        "event": "leave.approved",
        "to_email": "durga@arohak.com",
        "subject": "[EAOVA] Leave approved",
        "status": "failed",
        "attempts": 6,
        "last_error": "SMTP down",
        "created_at": datetime.now(UTC),
        "next_attempt_at": datetime.now(UTC),
        "sent_at": None,
    }
    base.update(fields)
    return SimpleNamespace(**base)


@pytest.mark.asyncio
async def test_retry_requeues_a_failed_email_with_fresh_retries() -> None:
    row = _row()
    db = AsyncMock()
    db.get = AsyncMock(return_value=row)
    out = await svc.retry_delivery(db, row.id)
    assert (row.status, row.attempts) == ("pending", 0)
    assert out["status"] == "pending"
    assert out["eventName"] == "Leave approved"


@pytest.mark.asyncio
async def test_withdraw_stops_a_waiting_email() -> None:
    row = _row(status="pending", attempts=4, last_error="SMTP down")
    db = AsyncMock()
    db.get = AsyncMock(return_value=row)
    out = await svc.withdraw_delivery(db, row.id)
    assert row.status == "failed"
    assert row.last_error == svc.WITHDRAWN_ERROR
    assert row.attempts == 4
    assert out["status"] == "failed"
    assert out["lastError"] == svc.WITHDRAWN_ERROR


@pytest.mark.asyncio
async def test_withdraw_refuses_a_sent_email() -> None:
    db = AsyncMock()
    db.get = AsyncMock(return_value=_row(status="sent"))
    with pytest.raises(HTTPException) as exc:
        await svc.withdraw_delivery(db, uuid.uuid4())
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_retry_refuses_sent_email() -> None:
    db = AsyncMock()
    db.get = AsyncMock(return_value=_row(status="sent"))
    with pytest.raises(HTTPException) as exc:
        await svc.retry_delivery(db, uuid.uuid4())
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_list_rejects_unknown_status() -> None:
    with pytest.raises(HTTPException):
        await svc.list_deliveries(AsyncMock(), status_filter="lost", search=None, page=0, page_size=25)


@pytest.mark.asyncio
async def test_list_returns_items_counts_and_total() -> None:
    row = _row(status="sent", sent_at=datetime.now(UTC))
    total, counts, rows = MagicMock(), MagicMock(), MagicMock()
    total.scalar_one.return_value = 1
    counts.all.return_value = [("sent", 1), ("failed", 2)]
    rows.scalars.return_value.all.return_value = [row]
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[total, counts, rows])
    out = await svc.list_deliveries(db, status_filter="sent", search="durga", page=0, page_size=25)
    assert out["total"] == 1
    assert out["counts"] == {"pending": 0, "sent": 1, "failed": 2}
    assert out["items"][0]["toEmail"] == "durga@arohak.com"
    assert out["items"][0]["nextAttemptAt"] is None


@pytest.mark.asyncio
async def test_send_test_queues_a_sample_of_the_saved_wording(monkeypatch: pytest.MonkeyPatch) -> None:
    queued: dict[str, str] = {}

    async def fake_queue(**kwargs: str) -> None:
        queued.update(kwargs)

    monkeypatch.setattr(svc, "queue_email", fake_queue)
    out = await svc.send_test_email("leave.approved", " durga.paruchuri@arohak.com ")
    assert out["toEmail"] == "durga.paruchuri@arohak.com"
    assert out["subject"].startswith("[EAOVA] Leave approved")
    assert queued["to_email"] == "durga.paruchuri@arohak.com"
    assert queued["event"] == "leave.approved"
    assert "Alex Morgan" in queued["text_body"]


@pytest.mark.asyncio
async def test_send_test_rejects_a_bad_address_and_a_fixed_layout() -> None:
    with pytest.raises(HTTPException) as bad_address:
        await svc.send_test_email("leave.approved", "not-an-email")
    assert bad_address.value.status_code == 400
    with pytest.raises(HTTPException) as fixed:
        await svc.send_test_email("asset.assigned", "durga.paruchuri@arohak.com")
    assert fixed.value.status_code == 400


@pytest.mark.asyncio
async def test_template_catalog_lists_every_email_with_recipients() -> None:
    db = AsyncMock()
    result = MagicMock()
    result.scalars.return_value.all.return_value = []
    db.execute = AsyncMock(return_value=result)
    catalog = await svc.list_templates(db)
    keys = {item["key"] for item in catalog}
    assert {"leave.submitted", "asset.assigned", "employee.invite"} <= keys
    assert all(item["recipients"] for item in catalog)
    assert all(item["customized"] is False for item in catalog)
    fixed = next(item for item in catalog if item["key"] == "asset.assigned")
    assert fixed["editable"] is False and fixed["body"] is None
    leave = next(item for item in catalog if item["key"] == "leave.approved")
    assert leave["subject"] == leave["defaultSubject"]
