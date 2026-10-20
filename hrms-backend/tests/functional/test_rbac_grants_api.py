"""Functional coverage for Manage Access grant APIs (RBAC-DATA-2)."""

from __future__ import annotations

import os
import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.modules.rbac.catalog import MODULE_CLIENTS, MODULE_COMPANY_SETUP
from tests.helpers.session_login import (
    create_disposable_employee,
    delete_disposable_employee,
    establish_session,
)

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


@pytest.fixture
async def target() -> tuple[uuid.UUID, str]:
    """Disposable EMPLOYEE — Superadmin cannot manage its own (Superadmin) row."""
    employee_id, email = await create_disposable_employee()
    try:
        yield employee_id, email
    finally:
        await delete_disposable_employee(employee_id)


async def _admin_session(client: AsyncClient) -> None:
    try:
        await establish_session(client, DEV_EMAIL)
    except Exception:
        pytest.skip("Superadmin sign-in failed — is developer@example.com in SUPERADMIN_EMAILS?")
    token = client.cookies.get("eaova_csrf")
    assert token
    client.headers["X-CSRF-Token"] = token


async def _modules_by_name(client: AsyncClient) -> dict[str, dict]:
    modules = await client.get("/api/v1/rbac/modules")
    assert modules.status_code == 200
    return {row["moduleName"]: row for row in modules.json()}


@pytest.mark.asyncio
async def test_rbac_grants_require_auth(client: AsyncClient) -> None:
    response = await client.get("/api/v1/rbac/employees/search", params={"email": "dev"})
    assert response.status_code == 401


@pytest.mark.asyncio
@pytest.mark.skipif(SKIP_DB, reason=DB_SKIP_REASON)
async def test_search_upsert_list_grants_happy_path(
    client: AsyncClient, target: tuple[uuid.UUID, str]
) -> None:
    await _admin_session(client)
    target_id, target_email = target

    search = await client.get(
        "/api/v1/rbac/employees/search",
        params={"email": target_email.split("@")[0]},
    )
    assert search.status_code == 200
    matches = search.json()
    assert isinstance(matches, list)
    assert len(matches) == 1
    employee_id = matches[0]["employeeId"]
    assert employee_id == str(target_id)
    assert matches[0]["email"].lower() == target_email.lower()

    clients = (await _modules_by_name(client))[MODULE_CLIENTS]

    flat_put = await client.put(
        f"/api/v1/rbac/employees/{employee_id}/grants",
        json={"moduleId": clients["moduleId"], "accessLevel": "full_access"},
    )
    assert flat_put.status_code == 200, flat_put.text
    flat_body = flat_put.json()
    assert len(flat_body) == 1
    assert flat_body[0]["moduleId"] == clients["moduleId"]
    assert flat_body[0]["submoduleId"] is None
    assert flat_body[0]["accessLevel"] == "full_access"
    assert flat_body[0]["status"] == "Active"

    # Upsert same combo updates level — no duplicate Active row.
    flat_put2 = await client.put(
        f"/api/v1/rbac/employees/{employee_id}/grants",
        json={"moduleId": clients["moduleId"], "accessLevel": "read_only"},
    )
    assert flat_put2.status_code == 200
    assert flat_put2.json()[0]["accessLevel"] == "read_only"
    assert flat_put2.json()[0]["grantId"] == flat_body[0]["grantId"]

    listed = await client.get(f"/api/v1/rbac/employees/{employee_id}/grants")
    assert listed.status_code == 200
    assert any(
        g["moduleId"] == clients["moduleId"] and g["submoduleId"] is None
        for g in listed.json()
    )


@pytest.mark.asyncio
@pytest.mark.skipif(SKIP_DB, reason=DB_SKIP_REASON)
async def test_upsert_rejects_submodules_on_flat_module(
    client: AsyncClient, target: tuple[uuid.UUID, str]
) -> None:
    await _admin_session(client)
    target_id, _ = target
    clients = (await _modules_by_name(client))[MODULE_CLIENTS]

    response = await client.put(
        f"/api/v1/rbac/employees/{target_id}/grants",
        json={
            "moduleId": clients["moduleId"],
            "accessLevel": "full_access",
            "submoduleIds": [1],
        },
    )
    assert response.status_code == 400


@pytest.mark.asyncio
@pytest.mark.skipif(SKIP_DB, reason=DB_SKIP_REASON)
async def test_patch_and_revoke_grant_excludes_from_active_list(
    client: AsyncClient, target: tuple[uuid.UUID, str]
) -> None:
    await _admin_session(client)
    employee_id, _ = target
    clients = (await _modules_by_name(client))[MODULE_CLIENTS]

    created = await client.put(
        f"/api/v1/rbac/employees/{employee_id}/grants",
        json={"moduleId": clients["moduleId"], "accessLevel": "full_access"},
    )
    assert created.status_code == 200
    grant_id = created.json()[0]["grantId"]

    patched = await client.patch(
        f"/api/v1/rbac/employees/{employee_id}/grants/{grant_id}",
        json={"accessLevel": "read_only"},
    )
    assert patched.status_code == 200
    assert patched.json()["accessLevel"] == "read_only"
    assert patched.json()["status"] == "Active"

    revoked = await client.post(
        f"/api/v1/rbac/employees/{employee_id}/grants/{grant_id}/revoke",
    )
    assert revoked.status_code == 200
    assert revoked.json()["status"] == "Revoked"

    active = await client.get(f"/api/v1/rbac/employees/{employee_id}/grants")
    assert active.status_code == 200
    assert all(g["grantId"] != grant_id for g in active.json())

    history = await client.get(
        f"/api/v1/rbac/employees/{employee_id}/grants",
        params={"includeRevoked": "true"},
    )
    assert history.status_code == 200
    match = next(g for g in history.json() if g["grantId"] == grant_id)
    assert match["status"] == "Revoked"


@pytest.mark.asyncio
@pytest.mark.skipif(SKIP_DB, reason=DB_SKIP_REASON)
async def test_save_access_replaces_active_grant_set(
    client: AsyncClient, target: tuple[uuid.UUID, str]
) -> None:
    await _admin_session(client)
    employee_id, _ = target
    by_name = await _modules_by_name(client)
    clients = by_name[MODULE_CLIENTS]
    company = by_name[MODULE_COMPANY_SETUP]
    departments, rbac = company["submodules"][1], company["submodules"][-1]
    url = f"/api/v1/rbac/employees/{employee_id}/access"

    first = await client.put(
        url,
        json={
            "grants": [
                {"moduleId": clients["moduleId"], "accessLevel": "full_access"},
                {
                    "moduleId": company["moduleId"],
                    "submoduleId": departments["submoduleId"],
                    "accessLevel": "read_only",
                },
            ]
        },
    )
    assert first.status_code == 200, first.text
    rows = {(g["moduleId"], g["submoduleId"]): g for g in first.json()}
    assert set(rows) == {
        (clients["moduleId"], None),
        (company["moduleId"], departments["submoduleId"]),
    }

    second = await client.put(
        url,
        json={
            "grants": [
                {
                    "moduleId": company["moduleId"],
                    "submoduleId": departments["submoduleId"],
                    "accessLevel": "full_access",
                },
                {
                    "moduleId": company["moduleId"],
                    "submoduleId": rbac["submoduleId"],
                    "accessLevel": "read_only",
                },
            ]
        },
    )
    assert second.status_code == 200, second.text
    after = {(g["moduleId"], g["submoduleId"]): g for g in second.json()}
    assert set(after) == {
        (company["moduleId"], departments["submoduleId"]),
        (company["moduleId"], rbac["submoduleId"]),
    }
    dept = after[(company["moduleId"], departments["submoduleId"])]
    assert dept["accessLevel"] == "full_access"
    assert dept["grantId"] == rows[(company["moduleId"], departments["submoduleId"])]["grantId"]

    history = await client.get(
        f"/api/v1/rbac/employees/{employee_id}/grants",
        params={"includeRevoked": "true"},
    )
    revoked = next(g for g in history.json() if g["moduleId"] == clients["moduleId"])
    assert revoked["status"] == "Revoked"


@pytest.mark.asyncio
@pytest.mark.skipif(SKIP_DB, reason=DB_SKIP_REASON)
async def test_save_access_rejects_module_wide_grant_on_submodule_module(
    client: AsyncClient, target: tuple[uuid.UUID, str]
) -> None:
    await _admin_session(client)
    employee_id, _ = target
    company = (await _modules_by_name(client))[MODULE_COMPANY_SETUP]

    response = await client.put(
        f"/api/v1/rbac/employees/{employee_id}/access",
        json={"grants": [{"moduleId": company["moduleId"], "accessLevel": "full_access"}]},
    )
    assert response.status_code == 400
