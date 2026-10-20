"""Billing type is skipped for internal-client projects and required otherwise."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.modules.projects import service as svc

ACTOR = {"firstName": "Pat", "lastName": "HR"}


def _patch_create_helpers(monkeypatch: pytest.MonkeyPatch, *, is_internal: bool) -> dict:
    saved: dict = {}
    customer = SimpleNamespace(client_id=uuid4(), is_internal=is_internal)
    monkeypatch.setattr(svc, "_ensure_customer", AsyncMock(return_value=customer))
    monkeypatch.setattr(svc, "_assert_unique_name", AsyncMock())
    monkeypatch.setattr(svc, "_assert_unique_code", AsyncMock())
    monkeypatch.setattr(svc, "allocate_project_display_id", AsyncMock(return_value="PRJ00001"))
    monkeypatch.setattr(svc, "_replace_stakeholders", AsyncMock())
    monkeypatch.setattr(svc, "_replace_client_stakeholders", AsyncMock())

    async def fake_payload(_db, project):
        saved["project"] = project
        return {"billingType": project.billing_type}

    monkeypatch.setattr(svc, "_project_payload", fake_payload)
    return saved


def _body(**overrides) -> dict:
    body = {
        "clientId": str(uuid4()),
        "projectName": "Rollout",
        "projectCode": "ROLL1",
    }
    body.update(overrides)
    return body


def _db() -> MagicMock:
    db = MagicMock()
    db.flush = AsyncMock()
    return db


@pytest.mark.asyncio
async def test_internal_project_saves_without_billing_type(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_create_helpers(monkeypatch, is_internal=True)
    body = await svc.create_project(_db(), ACTOR, _body())
    assert body["billingType"] is None


@pytest.mark.asyncio
async def test_internal_project_drops_a_sent_billing_type(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_create_helpers(monkeypatch, is_internal=True)
    body = await svc.create_project(_db(), ACTOR, _body(billingType="Monthly"))
    assert body["billingType"] is None


@pytest.mark.asyncio
async def test_external_project_still_requires_billing_type(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_create_helpers(monkeypatch, is_internal=False)
    with pytest.raises(HTTPException) as exc:
        await svc.create_project(_db(), ACTOR, _body())
    assert exc.value.detail == "Billing type is required"

    body = await svc.create_project(_db(), ACTOR, _body(billingType="Monthly"))
    assert body["billingType"] == "Monthly"


@pytest.mark.asyncio
async def test_update_clears_billing_type_for_internal_client(monkeypatch: pytest.MonkeyPatch) -> None:
    client_id = uuid4()
    project = SimpleNamespace(
        project_id=uuid4(),
        client_id=client_id,
        billing_type="Monthly",
        project_name="Rollout",
    )
    lookup = MagicMock()
    lookup.scalar_one_or_none.return_value = project
    db = _db()
    db.execute = AsyncMock(return_value=lookup)
    db.get = AsyncMock(return_value=SimpleNamespace(client_id=client_id, is_internal=True))
    monkeypatch.setattr(svc, "_project_payload", AsyncMock(return_value={}))

    await svc.update_project(db, ACTOR, project.project_id, {"billingType": "Monthly"})
    assert project.billing_type is None
