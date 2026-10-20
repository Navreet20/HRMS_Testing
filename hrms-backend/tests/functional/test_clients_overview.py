"""GET /clients/overview: filters, order, paging and project counts done in SQL."""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, event

from app.db.session import async_session_maker, engine, get_db
from app.dependencies import get_current_user
from app.models.tables import Client, Project
from app.modules.clients import router as clients_router
from app.modules.clients import service as clients_svc
from tests.helpers import db as _test_db
from tests.helpers.db import DB_SKIP_REASON

SKIP_DB = _test_db.SKIP_DB

# Count, page, its locations, stakeholders, invoicing entities and account owner.
MAX_OVERVIEW_STATEMENTS = 5


def _client(tag: str, name: str, **over: Any) -> Client:
    values: dict[str, Any] = {
        "client_id": uuid.uuid4(),
        "client_status": "ACTIVE",
        "client_name": f"{name} {tag}",
        "client_company_contact_name": "Contact",
        "client_contact_email": "c@example.com",
        "industry": "Retail",
    }
    values.update(over)
    return Client(**values)


def _project(client: Client, name: str, status: str | None) -> Project:
    return Project(
        project_id=uuid.uuid4(),
        project_name=name,
        project_status=status,
        client_id=client.client_id,
    )


@pytest.fixture
async def tag() -> AsyncIterator[str]:
    tag = uuid.uuid4().hex[:8]
    async with async_session_maker() as session:
        zeta = _client(tag, "Zeta")
        alpha = _client(tag, "Alpha", industry="Healthcare")
        beta = _client(tag, "Beta", client_status="INACTIVE", industry="")
        beta.client_company_type = "Consulting"
        session.add_all([zeta, alpha, beta])
        await session.flush()
        session.add_all(
            [
                _project(alpha, "p1", "ACTIVE"),
                _project(alpha, "p2", "On Hold"),
                _project(alpha, "p3", "CLOSED"),
                _project(alpha, "p4", None),
                _project(zeta, "p5", "ACTIVE"),
            ]
        )
        await session.commit()
    yield tag
    async with async_session_maker() as session:
        ids = [
            row
            for (row,) in (
                await session.execute(
                    Client.__table__.select()
                    .with_only_columns(Client.client_id)
                    .where(Client.client_name.like(f"% {tag}"))
                )
            ).all()
        ]
        await session.execute(delete(Project).where(Project.client_id.in_(ids)))
        await session.execute(delete(Client).where(Client.client_id.in_(ids)))
        await session.commit()


async def _overview(**params: Any) -> dict:
    async with async_session_maker() as session:
        return await clients_svc.clients_overview(session, **params)


def _names(result: dict, tag: str) -> list[str]:
    return [row["clientName"].replace(f" {tag}", "") for row in result["items"]]


@pytest.mark.asyncio
@pytest.mark.skipif(SKIP_DB, reason=DB_SKIP_REASON)
async def test_counts_filters_and_order(tag: str) -> None:
    result = await _overview(q=tag, page_size=50)
    assert _names(result, tag) == ["Alpha", "Beta", "Zeta"]
    assert result["total"] == 3
    alpha = result["items"][0]
    # ACTIVE and a missing status run; On Hold is open but not active; CLOSED is neither.
    assert (alpha["projectCount"], alpha["activeProjectCount"], alpha["openProjectCount"]) == (4, 2, 3)
    assert result["items"][1]["projectCount"] == 0

    desc = await _overview(q=tag, sort_dir="desc", page_size=50)
    assert _names(desc, tag) == ["Zeta", "Beta", "Alpha"]

    archived = await _overview(q=tag, status_filter="Archived")
    assert _names(archived, tag) == ["Beta"]
    running = await _overview(q=tag, status_filter="ACTIVE")
    assert _names(running, tag) == ["Alpha", "Zeta"]

    # Industry falls back to the client type when the industry is blank.
    assert _names(await _overview(q=tag, industry="Consulting"), tag) == ["Beta"]
    assert _names(await _overview(q=tag, industry="Healthcare"), tag) == ["Alpha"]


@pytest.mark.asyncio
@pytest.mark.skipif(SKIP_DB, reason=DB_SKIP_REASON)
async def test_paging_and_search(tag: str) -> None:
    first = await _overview(q=tag, page_size=2, page=1)
    second = await _overview(q=tag, page_size=2, page=2)
    assert _names(first, tag) == ["Alpha", "Beta"]
    assert _names(second, tag) == ["Zeta"]
    assert (first["total"], first["pageCount"], second["page"]) == (3, 2, 2)

    # A page past the end lands on the last page instead of coming back empty.
    beyond = await _overview(q=tag, page_size=2, page=9)
    assert beyond["page"] == 2 and _names(beyond, tag) == ["Zeta"]

    assert _names(await _overview(q=f"alpha {tag}"), tag) == ["Alpha"]
    assert (await _overview(q=f"nothing-{tag}"))["items"] == []


@pytest.mark.asyncio
@pytest.mark.skipif(SKIP_DB, reason=DB_SKIP_REASON)
async def test_overview_uses_few_statements(tag: str) -> None:
    statements: list[str] = []

    def _count(conn: Any, cursor: Any, statement: str, *args: Any) -> None:
        statements.append(statement)

    event.listen(engine.sync_engine, "before_cursor_execute", _count)
    try:
        await _overview(q=tag, page_size=50)
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", _count)
    assert len(statements) <= MAX_OVERVIEW_STATEMENTS, "\n".join(statements)


@pytest.mark.asyncio
@pytest.mark.skipif(SKIP_DB, reason=DB_SKIP_REASON)
async def test_route_passes_query_through(tag: str) -> None:
    app = FastAPI()
    app.include_router(clients_router.router, prefix="/api/v1/clients")
    read_gate = clients_router._clients_read
    app.dependency_overrides[read_gate] = lambda: {"employeeId": str(uuid.uuid4())}
    app.dependency_overrides[get_current_user] = lambda: {"employeeId": str(uuid.uuid4())}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        ok = await client.get(
            "/api/v1/clients/overview",
            params={"q": tag, "sortDir": "desc", "pageSize": 1, "page": 2},
        )
        assert ok.status_code == 200, ok.text
        body = ok.json()
        assert body["page"] == 2 and body["pageSize"] == 1 and body["total"] == 3
        assert _names(body, tag) == ["Beta"]
        assert (await client.get("/api/v1/clients/overview", params={"sort": "bogus"})).status_code == 400
        assert (await client.get("/api/v1/clients/overview", params={"sortDir": "up"})).status_code == 422
