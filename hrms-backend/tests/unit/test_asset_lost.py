"""Report lost / mark found for assets."""

from __future__ import annotations

from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.modules.assets import service as svc
from app.modules.assets.constants import (
    ACTION_FOUND,
    ACTION_REPORTED_LOST,
    ASSET_STATUS_ASSIGNED,
    ASSET_STATUS_DECOMMISSIONED,
    ASSET_STATUS_IN_STOCK,
    ASSET_STATUS_LOST,
    ASSET_STATUS_UNDER_REPAIR,
)

ACTOR = {"employeeId": str(uuid4()), "name": "Meena P"}


def _asset(status: str) -> SimpleNamespace:
    return SimpleNamespace(
        system_asset_id=uuid4(),
        asset_id="EAO-LAP-0001",
        status=status,
        condition="Good",
        category_id=uuid4(),
        model="ThinkPad",
        updated_by=None,
        updated_date=None,
    )


def _patches(asset, allocation=None, holder=None):
    logged: list[dict] = []
    notified: list[dict] = []

    async def fake_log(db, **kwargs):
        logged.append(kwargs)

    async def fake_notify(**kwargs):
        notified.append(kwargs)

    result = MagicMock()
    result.scalar_one_or_none.return_value = holder
    db = AsyncMock()
    db.execute = AsyncMock(return_value=result)
    ctx = [
        patch.object(svc, "_require_asset", AsyncMock(return_value=asset)),
        patch.object(svc, "_require_open_allocation", AsyncMock(return_value=allocation)),
        patch.object(svc, "_append_log", fake_log),
        patch.object(svc, "notify_asset_lost_or_found", fake_notify),
        patch.object(svc, "_category_map", AsyncMock(return_value={})),
        patch.object(svc, "_last_holder", AsyncMock(return_value=holder)),
        patch.object(svc, "asset_to_dict", lambda a, category_name=None: {"status": a.status}),
    ]
    return db, ctx, logged, notified


async def _run(ctx, coro_factory):
    from contextlib import ExitStack

    with ExitStack() as stack:
        for c in ctx:
            stack.enter_context(c)
        return await coro_factory()


@pytest.mark.asyncio
async def test_report_lost_closes_open_assignment_and_sets_lost() -> None:
    asset = _asset(ASSET_STATUS_ASSIGNED)
    allocation = SimpleNamespace(
        allocated_date=date.today() - timedelta(days=30),
        employee_id=uuid4(),
        returned_date=None,
        reason_for_return=None,
        return_notes=None,
        updated_by=None,
        updated_date=None,
    )
    holder = SimpleNamespace(first_name="Ross", last_name="Geller")
    db, ctx, logged, notified = _patches(asset, allocation, holder)

    out = await _run(
        ctx,
        lambda: svc.report_lost(
            db, ACTOR, asset.system_asset_id, {"reason": "stolen", "notes": "Left in a cab"}
        ),
    )

    assert out["status"] == ASSET_STATUS_LOST
    assert asset.status == ASSET_STATUS_LOST
    assert allocation.returned_date == date.today()
    assert allocation.reason_for_return == "Stolen"
    assert logged[0]["action_type"] == ACTION_REPORTED_LOST
    assert "Ross Geller" in logged[0]["notes"]
    assert notified[0]["kind"] == "lost"
    assert notified[0]["employee"] is holder


@pytest.mark.asyncio
async def test_report_lost_from_stock_needs_no_assignment() -> None:
    asset = _asset(ASSET_STATUS_IN_STOCK)
    db, ctx, logged, notified = _patches(asset)
    await _run(ctx, lambda: svc.report_lost(db, ACTOR, asset.system_asset_id, {}))
    assert asset.status == ASSET_STATUS_LOST
    assert notified[0]["employee"] is None


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [ASSET_STATUS_LOST, ASSET_STATUS_DECOMMISSIONED])
async def test_report_lost_rejects_assets_already_gone(status: str) -> None:
    asset = _asset(status)
    db, ctx, _, _ = _patches(asset)
    with pytest.raises(HTTPException) as exc:
        await _run(ctx, lambda: svc.report_lost(db, ACTOR, asset.system_asset_id, {}))
    assert exc.value.status_code == 400
    assert asset.status == status


@pytest.mark.asyncio
async def test_report_lost_rejects_future_date_and_bad_reason() -> None:
    asset = _asset(ASSET_STATUS_IN_STOCK)
    db, ctx, _, _ = _patches(asset)
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    with pytest.raises(HTTPException) as future:
        await _run(
            ctx, lambda: svc.report_lost(db, ACTOR, asset.system_asset_id, {"lostDate": tomorrow})
        )
    assert "future" in str(future.value.detail)
    with pytest.raises(HTTPException) as reason:
        await _run(
            ctx, lambda: svc.report_lost(db, ACTOR, asset.system_asset_id, {"reason": "Sold"})
        )
    assert "reason" in str(reason.value.detail)
    assert asset.status == ASSET_STATUS_IN_STOCK


@pytest.mark.asyncio
async def test_report_lost_rejects_date_before_assignment() -> None:
    asset = _asset(ASSET_STATUS_ASSIGNED)
    allocation = SimpleNamespace(allocated_date=date.today() - timedelta(days=2), employee_id=uuid4())
    db, ctx, _, _ = _patches(asset, allocation)
    early = (date.today() - timedelta(days=5)).isoformat()
    with pytest.raises(HTTPException) as exc:
        await _run(
            ctx, lambda: svc.report_lost(db, ACTOR, asset.system_asset_id, {"lostDate": early})
        )
    assert "before the asset was assigned" in str(exc.value.detail)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("condition", "status"),
    [
        ("Good", ASSET_STATUS_IN_STOCK),
        ("Damaged", ASSET_STATUS_UNDER_REPAIR),
        ("Not repairable", ASSET_STATUS_DECOMMISSIONED),
    ],
)
async def test_mark_found_condition_decides_status(condition: str, status: str) -> None:
    asset = _asset(ASSET_STATUS_LOST)
    db, ctx, logged, notified = _patches(asset)
    await _run(
        ctx, lambda: svc.mark_found(db, ACTOR, asset.system_asset_id, {"condition": condition})
    )
    assert asset.status == status
    assert logged[0]["action_type"] == ACTION_FOUND
    assert notified[0]["kind"] == "found"


@pytest.mark.asyncio
async def test_mark_found_needs_a_lost_asset_and_a_known_condition() -> None:
    asset = _asset(ASSET_STATUS_IN_STOCK)
    db, ctx, _, _ = _patches(asset)
    with pytest.raises(HTTPException) as not_lost:
        await _run(
            ctx, lambda: svc.mark_found(db, ACTOR, asset.system_asset_id, {"condition": "Good"})
        )
    assert "Only a Lost asset" in str(not_lost.value.detail)

    lost = _asset(ASSET_STATUS_LOST)
    db, ctx, _, _ = _patches(lost)
    with pytest.raises(HTTPException) as bad:
        await _run(ctx, lambda: svc.mark_found(db, ACTOR, lost.system_asset_id, {"condition": "Fine"}))
    assert "condition" in str(bad.value.detail)
    assert lost.status == ASSET_STATUS_LOST


def test_lost_assets_cannot_be_assigned() -> None:
    import asyncio

    asset = _asset(ASSET_STATUS_LOST)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(svc._assert_asset_assignable(AsyncMock(), asset))
    assert exc.value.status_code == 400


def test_lost_and_found_emails_are_editable_templates() -> None:
    from app.mail.templates import TEMPLATES, render

    for key in ("asset.lost", "asset.found"):
        assert TEMPLATES[key].editable
        mail = render(
            key,
            asset_id="EAO-LAP-0001",
            category="Laptop",
            model="ThinkPad",
            employee_name="Ross Geller",
            detail="Lost on 2026-09-28",
            notes="—",
            recorded_by="Meena P",
        )
        assert "EAO-LAP-0001" in mail.subject
        assert "Ross Geller" in mail.text_body


@pytest.mark.asyncio
async def test_a_lost_asset_emails_the_holder_at_work_and_personal_addresses() -> None:
    from app.modules.assets import notifications as notif

    sent: list[str] = []

    async def fake_send(**kwargs):
        sent.append(kwargs["to_email"])

    holder = SimpleNamespace(
        first_name="Ross",
        last_name="Geller",
        email_id="ross@work.com",
        personal_email="ross@home.com",
    )
    asset = SimpleNamespace(asset_id="EAO-LAP-0001", model="ThinkPad")
    with patch.object(notif, "send_email", fake_send), patch(
        "app.mail.recipients.notification_recipients",
        AsyncMock(return_value=["assets@work.com"]),
    ), patch.object(notif, "get_settings", lambda: SimpleNamespace(smtp_enabled=True)):
        await notif.notify_asset_lost_or_found(
            kind="lost",
            asset=asset,
            category=None,
            employee=holder,
            detail="Lost on 2026-09-28",
            notes=None,
            recorded_by="Meena P",
        )
    assert sorted(sent) == ["assets@work.com", "ross@home.com", "ross@work.com"]


def test_one_email_describes_a_whole_swap() -> None:
    from datetime import date

    from app.modules.assets.notifications import build_swap_email_bodies

    text, html = build_swap_email_bodies(
        employee_name="Ross",
        company="EAOVA",
        old_details=[("Asset ID", "EAO-LAP-0001")],
        new_details=[("Asset ID", "EAO-LAP-0009")],
        reason="Broken",
        condition_at_return="Poor",
        swapped_on=date(2026, 9, 29),
        processed_by="Meena P",
        from_name="EAOVA",
    )
    for body in (text, html):
        assert "EAO-LAP-0001" in body and "EAO-LAP-0009" in body
        assert "Broken" in body
