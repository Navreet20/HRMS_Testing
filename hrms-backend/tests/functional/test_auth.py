import os
import uuid
from datetime import date

import pytest
from httpx import ASGITransport, AsyncClient

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
async def test_health(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_protected_route_without_token_returns_401(client: AsyncClient) -> None:
    response = await client.get("/api/v1/timesheet-weeks/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_password_login_endpoint_removed(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": DEV_EMAIL, "password": "anything"},
    )
    # CSRF middleware may reject before the router 404s the removed path.
    assert response.status_code in {403, 404}


@pytest.mark.asyncio
async def test_entra_login_redirects(client: AsyncClient) -> None:
    response = await client.get("/api/v1/auth/entra/login", follow_redirects=False)
    assert response.status_code == 302
    location = response.headers.get("location") or ""
    assert "login.microsoftonline.com" in location
    assert "code_challenge" in location
    assert client.cookies.get("eaova_oidc")


def _csrf_headers(client: AsyncClient) -> dict[str, str]:
    token = client.cookies.get("eaova_csrf")
    assert token
    return {"X-CSRF-Token": token}


@pytest.mark.asyncio
@pytest.mark.skipif(SKIP_DB, reason=DB_SKIP_REASON)
async def test_session_and_access_protected_route(client: AsyncClient) -> None:
    try:
        body = await establish_session(client, DEV_EMAIL)
    except Exception:
        pytest.skip("Superadmin sign-in failed — is developer@example.com in SUPERADMIN_EMAILS?")

    assert "token" in body
    assert "userDetails" in body
    assert body["userDetails"]["emailId"] == DEV_EMAIL
    assert body["userDetails"].get("role") == "SUPERADMIN" or body[
        "userDetails"
    ].get("department") == "SUPERADMIN"
    assert client.cookies.get("eaova_access")

    # Cookie auth (no Authorization header)
    dash = await client.get("/api/v1/dashboard")
    assert dash.status_code == 200
    assert "activeEmployees" in dash.json()

    me = await client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["userDetails"]["emailId"] == DEV_EMAIL

    theme = await client.patch(
        "/api/v1/auth/theme-preference",
        json={"themePreference": "dark"},
        headers=_csrf_headers(client),
    )
    assert theme.status_code == 200
    assert theme.json()["themePreference"] == "dark"

    me_again = await client.get("/api/v1/auth/me")
    assert me_again.status_code == 200
    assert me_again.json()["userDetails"]["themePreference"] == "dark"

    quick = await client.patch(
        "/api/v1/auth/quick-actions-preference",
        json={"quickActionsPreference": ["projects", "schedule"]},
        headers=_csrf_headers(client),
    )
    assert quick.status_code == 200
    assert quick.json()["quickActionsPreference"] == ["projects", "schedule"]

    me_prefs = await client.get("/api/v1/auth/me")
    assert me_prefs.status_code == 200
    assert me_prefs.json()["userDetails"]["quickActionsPreference"] == [
        "projects",
        "schedule",
    ]

    logout = await client.post("/api/v1/auth/logout", headers=_csrf_headers(client))
    assert logout.status_code == 200

    after = await client.get("/api/v1/auth/me")
    assert after.status_code == 401


@pytest.mark.asyncio
@pytest.mark.skipif(SKIP_DB, reason=DB_SKIP_REASON)
async def test_mutating_without_csrf_returns_403(client: AsyncClient) -> None:
    try:
        await establish_session(client, DEV_EMAIL)
    except Exception:
        pytest.skip("Bootstrap admin missing")
    # Drop CSRF cookie value mismatch
    response = await client.post("/api/v1/auth/logout")
    assert response.status_code == 403


async def _cleanup_test_employee(employee_id: uuid.UUID) -> None:
    """Remove a disposable test employee, or deactivate it if it's no
    longer a NEW draft (hard-delete is only allowed for NEW drafts)."""
    from fastapi import HTTPException

    from app.db.session import async_session_maker
    from app.modules.employee.service import EmployeeService

    async with async_session_maker() as session:
        try:
            await EmployeeService().cascade_delete(session, employee_id)
            await session.commit()
            return
        except HTTPException as exc:
            await session.rollback()
            if exc.status_code == 404:
                return
            if exc.status_code != 400:
                raise
        except Exception:
            await session.rollback()
            raise

    async with async_session_maker() as session:
        try:
            await EmployeeService().status_update(session, employee_id)
            await session.commit()
        except HTTPException as exc:
            await session.rollback()
            if exc.status_code != 404:
                raise


@pytest.mark.asyncio
@pytest.mark.skipif(SKIP_DB, reason=DB_SKIP_REASON)
async def test_wrong_role_returns_403(client: AsyncClient) -> None:
    """Non-finance roles (EMPLOYEE) cannot list payrolls. ADMIN is a finance role."""
    from app.db.session import async_session_maker
    from app.models.tables import Employee

    email = f"payroll.denied.{uuid.uuid4().hex[:8]}@eaova.test"
    emp_id: uuid.UUID | None = None
    try:
        async with async_session_maker() as session:
            employee = Employee(
                first_name="Payroll",
                last_name="Denied",
                email_id=email,
                department="EMPLOYEE",
                company="EAOVA",
                role="EMPLOYEE",
                employment_type="FULL_TIME",
                status="ACTIVE",
                employment_start_date=date.today().isoformat(),
                password=None,
            )
            session.add(employee)
            await session.commit()
            await session.refresh(employee)
            emp_id = employee.employee_id

        await establish_session(client, email)
        response = await client.get("/api/v1/payrolls")
        assert response.status_code == 403
    finally:
        if emp_id is not None:
            await _cleanup_test_employee(emp_id)
