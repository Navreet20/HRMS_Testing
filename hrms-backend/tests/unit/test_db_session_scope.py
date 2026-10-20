"""The request's database session commits before the response is sent.

A client that reads right after a successful write (save, then reload the
list) must see the write; committing after the response raced that read.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app import dependencies as deps_module
from app.db.session import get_db
from app.modules.deps import CurrentUser, DbSession


def _build_app(events: list[str], sessions: list[object]) -> FastAPI:
    app = FastAPI()

    @app.put("/write")
    async def write(user: CurrentUser, db: DbSession) -> dict[str, Any]:
        events.append("handler")
        return {"ok": True, "same_session": db is sessions[0]}

    async def _db() -> Any:
        session = object()
        sessions.append(session)
        yield session
        events.append("commit")

    app.dependency_overrides[get_db] = _db

    async def record_response_start(scope, receive, send):  # type: ignore[no-untyped-def]
        async def _send(message):  # type: ignore[no-untyped-def]
            if message["type"] == "http.response.start":
                events.append("response")
            await send(message)

        await inner(scope, receive, _send)

    inner = app.build_middleware_stack()
    app.middleware_stack = record_response_start  # type: ignore[assignment]
    return app


async def test_commit_happens_before_the_response_is_sent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        deps_module, "get_settings", lambda: SimpleNamespace(auth_bypass=True)
    )
    events: list[str] = []
    sessions: list[object] = []
    transport = ASGITransport(app=_build_app(events, sessions))
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.put("/write")

    assert response.status_code == 200
    assert events == ["handler", "commit", "response"]


async def test_user_lookup_and_route_share_one_session(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        deps_module, "get_settings", lambda: SimpleNamespace(auth_bypass=True)
    )
    events: list[str] = []
    sessions: list[object] = []
    transport = ASGITransport(app=_build_app(events, sessions))
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.put("/write")

    assert len(sessions) == 1
    assert response.json()["same_session"] is True
