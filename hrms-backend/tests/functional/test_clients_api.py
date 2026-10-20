"""HR Clients API: nested create, unique name, role gate."""

from __future__ import annotations

import os
import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.config import get_settings
from app.db.session import get_db
from app.dependencies import get_current_user
from app.modules.clients import router as clients_router
from app.modules.clients import service as clients_svc

from tests.helpers.db import DB_SKIP_REASON
from tests.helpers import db as _test_db

SKIP_DB = _test_db.SKIP_DB
DEV_EMAIL = os.getenv("DEV_EMAIL", "developer@example.com")
DEV_PASSWORD = os.getenv("DEV_PASSWORD", "Password123!")


@pytest.fixture(autouse=True)
def _auth_bypass_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AUTH_BYPASS", "false")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()

HR_USER = {
    "employeeId": str(uuid.uuid4()),
    "emailId": "hr@example.com",
    "department": "HR",
    "firstName": "Pat",
    "lastName": "HR",
}

ADMIN_USER = {
    "employeeId": str(uuid.uuid4()),
    "emailId": "admin@example.com",
    "department": "ADMIN",
    "firstName": "Ada",
    "lastName": "Admin",
}

EMPLOYEE_USER = {
    "employeeId": str(uuid.uuid4()),
    "emailId": "worker@example.com",
    "department": "EMPLOYEE",
    "firstName": "Sam",
    "lastName": "Worker",
}


def _build_app(user: dict[str, Any]) -> FastAPI:
    app = FastAPI()
    app.include_router(clients_router.router, prefix="/api/v1/clients")

    async def _user() -> dict[str, Any]:
        return user

    async def _db() -> Any:
        yield MagicMock()

    app.dependency_overrides[get_current_user] = _user
    app.dependency_overrides[get_db] = _db
    return app


@pytest.fixture
async def hr_client() -> AsyncClient:
    transport = ASGITransport(app=_build_app(HR_USER))
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def admin_client() -> AsyncClient:
    transport = ASGITransport(app=_build_app(ADMIN_USER))
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def employee_client() -> AsyncClient:
    transport = ASGITransport(app=_build_app(EMPLOYEE_USER))
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


def _nested_body(name: str) -> dict[str, Any]:
    return {
        "clientName": name,
        "industry": "Healthcare",
        "clientCategory": "direct",
        "locations": [
            {
                "locationName": "NYC office",
                "address": "1 Market St",
                "city": "New York",
                "stateProvince": "NY",
                "country": "US",
                "region": "NA",
            }
        ],
        "stakeholders": [{"name": "Pat Client", "title": "Director", "department": "Ops"}],
    }


@pytest.mark.asyncio
async def test_clients_alias_lists_industries(
    hr_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    mock = AsyncMock(return_value=[{"name": "Healthcare"}])
    monkeypatch.setattr(clients_svc, "list_industries", mock)
    response = await hr_client.get("/api/v1/clients/industries")
    assert response.status_code == 200
    assert response.json()[0]["name"] == "Healthcare"


@pytest.mark.asyncio
async def test_employee_cannot_create_client(employee_client: AsyncClient) -> None:
    response = await employee_client.post("/api/v1/clients", json=_nested_body("Blocked Co"))
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_can_list_and_create_clients(
    admin_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    list_mock = AsyncMock(return_value=[])
    create_mock = AsyncMock(
        return_value={
            "customerId": str(uuid.uuid4()),
            "customerName": "Admin Allowed Co",
            "industry": "Healthcare",
            "locations": [],
            "stakeholders": [],
            "invoicingEntities": [],
        }
    )
    monkeypatch.setattr(clients_svc, "list_clients", list_mock)
    monkeypatch.setattr(clients_svc, "create_client", create_mock)

    listed = await admin_client.get("/api/v1/clients")
    assert listed.status_code == 200
    list_mock.assert_awaited_once()

    created = await admin_client.post("/api/v1/clients", json=_nested_body("Admin Allowed Co"))
    assert created.status_code == 200
    create_mock.assert_awaited_once()


@pytest.mark.asyncio
async def test_hr_lists_industries(hr_client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    mock = AsyncMock(return_value=[{"name": "Healthcare"}, {"name": "Technology"}])
    monkeypatch.setattr(clients_svc, "list_industries", mock)
    response = await hr_client.get("/api/v1/clients/industries")
    assert response.status_code == 200
    assert response.json()[0]["name"] == "Healthcare"
    mock.assert_awaited_once()


@pytest.mark.asyncio
async def test_hr_create_client_calls_nested_service(
    hr_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    mock = AsyncMock(
        return_value={
            "customerId": str(uuid.uuid4()),
            "customerName": "Nova Therapeutics Inc",
            "industry": "Healthcare",
            "locations": [{"locationName": "NYC office"}],
            "stakeholders": [{"name": "Pat Client"}],
            "invoicingEntities": [],
        }
    )
    monkeypatch.setattr(clients_svc, "create_client", mock)
    response = await hr_client.post(
        "/api/v1/clients", json=_nested_body("Nova Therapeutics Inc")
    )
    assert response.status_code == 200
    mock.assert_awaited_once()
    args = mock.await_args.args
    assert args[2]["clientName"] == "Nova Therapeutics Inc"
    assert args[2]["locations"][0]["country"] == "US"
    assert "invoicingEntities" not in args[2] or args[2].get("invoicingEntities") in (None, [])


@pytest.fixture
async def live_client() -> AsyncClient:
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


def _csrf_headers(client: AsyncClient) -> dict[str, str]:
    token = client.cookies.get("eaova_csrf")
    assert token
    return {"X-CSRF-Token": token}


@pytest.mark.asyncio
@pytest.mark.skipif(SKIP_DB, reason=DB_SKIP_REASON)
async def test_live_nested_client_create_and_unique_name(live_client: AsyncClient) -> None:
    from app.modules.rbac.catalog import MODULE_CLIENTS
    from tests.helpers.session_login import ensure_module_grant, establish_session

    try:
        await establish_session(live_client, DEV_EMAIL)
    except Exception:
        pytest.skip("Superadmin sign-in failed — is developer@example.com in SUPERADMIN_EMAILS?")
    await ensure_module_grant(DEV_EMAIL, MODULE_CLIENTS)

    name = f"Nova Nested {uuid.uuid4().hex[:8]}"
    created_id = None
    try:
        industries = await live_client.get("/api/v1/clients/industries")
        assert industries.status_code == 200, industries.text
        names = [row["name"] for row in industries.json()]
        assert "Healthcare" in names

        unknown = await live_client.post(
            "/api/v1/clients",
            json=_nested_body(name) | {"industry": "Not an industry"},
            headers=_csrf_headers(live_client),
        )
        assert unknown.status_code == 400

        created = await live_client.post(
            "/api/v1/clients",
            json=_nested_body(name),
            headers=_csrf_headers(live_client),
        )
        assert created.status_code == 200, created.text
        body = created.json()
        created_id = body["id"]
        assert body["clientName"] == name
        assert body["industry"] == "Healthcare"
        assert body["clientCategory"] == "direct"
        assert len(body["locations"]) == 1
        assert body["locations"][0]["country"] == "US"
        assert body["stakeholders"][0]["name"] == "Pat Client"
        assert body["locations"][0]["clientLocationId"]
        assert body["stakeholders"][0]["stakeholderId"]
        assert body.get("invoicingEntities") == []

        conflict = await live_client.post(
            "/api/v1/clients",
            json=_nested_body(name),
            headers=_csrf_headers(live_client),
        )
        assert conflict.status_code == 409

        patched = await live_client.patch(
            f"/api/v1/clients/{created_id}",
            json={
                "clientName": f"{name} Updated",
                "industry": "Healthcare",
                "isInternal": True,
                "locations": [
                    {
                        "id": body["locations"][0]["id"],
                        "clientLocationId": body["locations"][0]["clientLocationId"],
                        "locationName": "NYC office",
                        "address": "1 Market St",
                        "city": "New York",
                        "stateProvince": "NY",
                        "country": "US",
                        "region": "NA",
                    }
                ],
                "stakeholders": [
                    {
                        "id": body["stakeholders"][0]["id"],
                        "stakeholderId": body["stakeholders"][0]["stakeholderId"],
                        "name": "Pat Client",
                        "title": "Director",
                        "department": "Ops",
                        "email": "durga@gmail.com",
                    }
                ],
            },
            headers=_csrf_headers(live_client),
        )
        assert patched.status_code == 200, patched.text
        assert patched.json()["clientName"] == f"{name} Updated"
        assert patched.json()["isInternal"] is True
        assert patched.json()["clientCategory"] == "internal"
        assert patched.json()["stakeholders"][0]["email"] == "durga@gmail.com"
        assert patched.json()["contactEmail"] == "durga@gmail.com"

        listed = await live_client.get("/api/v1/clients")
        assert listed.status_code == 200, listed.text
        found = next(row for row in listed.json() if row["id"] == created_id)
        assert found["stakeholders"][0]["email"] == "durga@gmail.com"
        assert found["contactEmail"] == "durga@gmail.com"
    finally:
        if created_id:
            await live_client.delete(
                f"/api/v1/clients/{created_id}",
                headers=_csrf_headers(live_client),
            )


@pytest.mark.asyncio
async def test_archive_and_restore_client_routes(
    hr_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    client_id = uuid.uuid4()
    archived = {
        "id": str(client_id),
        "customerId": str(client_id),
        "clientStatus": "Archived",
        "customerStatus": "Archived",
    }
    restored = {**archived, "clientStatus": "ACTIVE", "customerStatus": "ACTIVE"}
    archive_mock = AsyncMock(return_value=archived)
    restore_mock = AsyncMock(return_value=restored)
    monkeypatch.setattr(clients_svc, "archive_client", archive_mock)
    monkeypatch.setattr(clients_svc, "restore_client", restore_mock)

    archived_response = await hr_client.post(f"/api/v1/clients/{client_id}/archive")
    assert archived_response.status_code == 200
    assert archived_response.json()["clientStatus"] == "Archived"
    archive_mock.assert_awaited_once()

    restored_response = await hr_client.post(f"/api/v1/clients/{client_id}/restore")
    assert restored_response.status_code == 200
    assert restored_response.json()["clientStatus"] == "ACTIVE"
    restore_mock.assert_awaited_once()

    delete_response = await hr_client.delete(f"/api/v1/clients/{client_id}")
    assert delete_response.status_code == 200
    assert archive_mock.await_count == 2


@pytest.mark.asyncio
async def test_creating_an_invoice_passes_the_client_id_to_the_service(
    admin_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    client_id = uuid.uuid4()
    create_mock = AsyncMock(return_value={"invoiceNumber": "INV-9"})
    monkeypatch.setattr(clients_svc, "create_client_invoice", create_mock)

    response = await admin_client.post(
        f"/api/v1/clients/{client_id}/invoices",
        json={"invoiceNumber": "INV-9", "invoicedAmount": 100},
    )

    assert response.status_code == 200
    assert response.json()["invoiceNumber"] == "INV-9"
    payload = create_mock.await_args.args[2]
    assert payload["customerId"] == str(client_id)
    assert payload["invoiceNumber"] == "INV-9"


@pytest.mark.asyncio
async def test_employee_cannot_create_an_invoice(employee_client: AsyncClient) -> None:
    response = await employee_client.post(
        f"/api/v1/clients/{uuid.uuid4()}/invoices", json={"invoiceNumber": "INV-1"}
    )
    assert response.status_code == 403
