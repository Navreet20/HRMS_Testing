"""Functional coverage for GET /api/v1/rbac/modules (RBAC-DATA-1)."""

from __future__ import annotations

import os

import pytest
from httpx import ASGITransport, AsyncClient

from app.modules.rbac.catalog import (
    DEFAULT_RBAC_CATALOG,
    MODULE_ASSET_MANAGEMENT,
    MODULE_EMPLOYEE_PORTAL,
)
from tests.helpers.session_login import establish_session

DEV_EMAIL = os.getenv("DEV_EMAIL", "developer@example.com")
from tests.helpers.db import DB_SKIP_REASON
from tests.helpers import db as _test_db

SKIP_DB = _test_db.SKIP_DB


@pytest.fixture
async def client() -> AsyncClient:
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
@pytest.mark.skipif(SKIP_DB, reason=DB_SKIP_REASON)
async def test_rbac_modules_lists_active_catalog_for_admin(
    client: AsyncClient,
) -> None:
    try:
        await establish_session(client, DEV_EMAIL)
    except Exception:
        pytest.skip("Superadmin sign-in failed — is developer@example.com in SUPERADMIN_EMAILS?")

    response = await client.get("/api/v1/rbac/modules")
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    by_name = {row["moduleName"]: row for row in body}
    assert set(by_name) == {entry.name for entry in DEFAULT_RBAC_CATALOG}
    for entry in DEFAULT_RBAC_CATALOG:
        row = by_name[entry.name]
        assert row["hasSubmodules"] is entry.has_submodules
        assert [s["submoduleName"] for s in row["submodules"]] == [
            sub.name for sub in entry.submodules
        ]
    # Employee Portal is derived per session, never granted.
    assert MODULE_EMPLOYEE_PORTAL not in by_name
    assert by_name[MODULE_ASSET_MANAGEMENT]["hasSubmodules"] is False
    assert by_name[MODULE_ASSET_MANAGEMENT]["submodules"] == []
    assert all(row["status"] == "Active" for row in body)
    for row in body:
        assert all(s["status"] == "Active" for s in row["submodules"])


@pytest.mark.asyncio
async def test_rbac_modules_requires_auth(client: AsyncClient) -> None:
    response = await client.get("/api/v1/rbac/modules")
    assert response.status_code == 401
