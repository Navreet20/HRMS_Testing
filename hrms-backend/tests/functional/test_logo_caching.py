"""Logos: versioned URLs cache for a year, revalidation is cheap, reads do not block."""

from __future__ import annotations

import threading
import uuid
from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.db.session import get_db
from app.dependencies import get_current_user
from app.modules.clients import router as clients_router
from app.modules.clients import service as clients_svc

KEY = "clients/00000000-0000-0000-0000-000000000001/logo/abc.png"
CLIENT_ID = uuid.uuid4()


class _Storage:
    def __init__(self) -> None:
        self.reads: list[tuple[str, str]] = []

    def get_bytes(self, key: str) -> tuple[bytes, str]:
        self.reads.append((key, threading.current_thread().name))
        return b"png-bytes", "image/png"


@pytest.fixture
def storage(monkeypatch: pytest.MonkeyPatch) -> _Storage:
    fake = _Storage()
    monkeypatch.setattr(clients_router, "get_storage", lambda: fake)

    async def _key(db: Any, client_id: uuid.UUID) -> str:
        return KEY

    monkeypatch.setattr(clients_svc, "get_logo_key", _key)
    return fake


@pytest.fixture
async def client(storage: _Storage) -> AsyncClient:
    app = FastAPI()
    app.include_router(clients_router.router, prefix="/api/v1/clients")

    async def _db() -> Any:
        yield MagicMock()

    app.dependency_overrides[clients_router._clients_read] = lambda: {}
    app.dependency_overrides[get_current_user] = lambda: {}
    app.dependency_overrides[get_db] = _db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_versioned_logo_is_cached_for_a_year(client: AsyncClient) -> None:
    response = await client.get(f"/api/v1/clients/{CLIENT_ID}/logo", params={"v": KEY})
    assert response.status_code == 200
    assert response.content == b"png-bytes"
    assert response.headers["cache-control"] == "private, max-age=31536000, immutable"
    assert response.headers["etag"]
    assert response.headers["server-timing"].startswith("storage;dur=")


@pytest.mark.asyncio
async def test_old_or_missing_version_keeps_the_short_cache(client: AsyncClient) -> None:
    plain = await client.get(f"/api/v1/clients/{CLIENT_ID}/logo")
    stale = await client.get(f"/api/v1/clients/{CLIENT_ID}/logo", params={"v": "old-key"})
    assert plain.headers["cache-control"] == "private, max-age=60"
    assert stale.headers["cache-control"] == "private, max-age=60"
    assert stale.content == b"png-bytes"


@pytest.mark.asyncio
async def test_matching_etag_answers_304_without_reading_storage(
    client: AsyncClient, storage: _Storage
) -> None:
    first = await client.get(f"/api/v1/clients/{CLIENT_ID}/logo")
    storage.reads.clear()
    again = await client.get(
        f"/api/v1/clients/{CLIENT_ID}/logo",
        headers={"If-None-Match": first.headers["etag"]},
    )
    assert again.status_code == 304
    assert again.content == b""
    assert storage.reads == []


@pytest.mark.asyncio
async def test_storage_is_read_off_the_event_loop(
    client: AsyncClient, storage: _Storage
) -> None:
    await client.get(f"/api/v1/clients/{CLIENT_ID}/logo")
    assert storage.reads, "storage was not read"
    assert storage.reads[0][1] != threading.main_thread().name
