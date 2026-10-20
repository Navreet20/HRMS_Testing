"""Read-only POST /employees/code-preview: no reservation, no INSERT."""

from __future__ import annotations

import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.config import get_settings
from app.db.session import get_db
from app.dependencies import get_current_user
from app.modules.employee import router as employees_router

HR_USER = {
    "employeeId": str(uuid.uuid4()),
    "emailId": "hr@example.com",
    "department": "HR",
    "role": "HR",
    "firstName": "Pat",
    "lastName": "HR",
}

EMPLOYEE_USER = {
    "employeeId": str(uuid.uuid4()),
    "emailId": "worker@example.com",
    "department": "EMPLOYEE",
    "role": "EMPLOYEE",
    "firstName": "Sam",
    "lastName": "Worker",
}


def _codes_session(codes: list[str | None]) -> MagicMock:
    session = MagicMock()
    session.add = MagicMock()
    result = MagicMock()
    result.scalars.return_value.all.return_value = codes
    session.execute = AsyncMock(return_value=result)
    return session


def _build_app(user: dict[str, Any] | None, session: MagicMock | None = None) -> FastAPI:
    app = FastAPI()
    app.include_router(employees_router.router, prefix="/api/v1")
    db_session = session or _codes_session([])

    async def _user() -> dict[str, Any]:
        assert user is not None
        return user

    async def _db() -> Any:
        yield db_session

    app.dependency_overrides[get_db] = _db
    if user is not None:
        app.dependency_overrides[get_current_user] = _user
    return app


@pytest.fixture
async def hr_client():
    transport = ASGITransport(app=_build_app(HR_USER))
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def employee_client():
    transport = ASGITransport(app=_build_app(EMPLOYEE_USER))
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_preview_returns_stem_when_free() -> None:
    session = _codes_session([])
    transport = ASGITransport(app=_build_app(HR_USER, session))
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/employees/code-preview",
            json={"firstName": "Jane", "lastName": "Doe"},
        )
    assert response.status_code == 200
    assert response.json() == {"employeeCode": "JAN_DOE"}
    assert "businessEmployeeId" not in response.json()
    session.add.assert_not_called()


@pytest.mark.asyncio
async def test_preview_returns_suffix_when_stem_exists() -> None:
    session = _codes_session(["JAN_DOE"])
    transport = ASGITransport(app=_build_app(HR_USER, session))
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/employees/code-preview",
            json={"firstName": "Jane", "lastName": "Doe"},
        )
    assert response.status_code == 200
    assert response.json() == {"employeeCode": "JAN_DOE-2"}
    session.add.assert_not_called()


@pytest.mark.asyncio
async def test_preview_does_not_create_employee_row() -> None:
    session = _codes_session([])
    add_count_before = session.add.call_count
    transport = ASGITransport(app=_build_app(HR_USER, session))
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/employees/code-preview",
            json={"firstName": "Satya", "lastName": "Hegde"},
        )
    assert response.status_code == 200
    assert response.json()["employeeCode"] == "SAT_HEG"
    assert session.add.call_count == add_count_before


@pytest.mark.asyncio
async def test_preview_requires_first_and_last(hr_client: AsyncClient) -> None:
    missing_last = await hr_client.post(
        "/api/v1/employees/code-preview",
        json={"firstName": "Jane"},
    )
    missing_first = await hr_client.post(
        "/api/v1/employees/code-preview",
        json={"lastName": "Doe"},
    )
    blank = await hr_client.post(
        "/api/v1/employees/code-preview",
        json={"firstName": "  ", "lastName": "Doe"},
    )
    assert missing_last.status_code == 400
    assert missing_first.status_code == 400
    assert blank.status_code == 400


@pytest.mark.asyncio
async def test_preview_forbidden_for_employee(employee_client: AsyncClient) -> None:
    response = await employee_client.post(
        "/api/v1/employees/code-preview",
        json={"firstName": "Jane", "lastName": "Doe"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_preview_unauthorized_without_token(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AUTH_BYPASS", "false")
    get_settings.cache_clear()
    transport = ASGITransport(app=_build_app(None))
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/employees/code-preview",
                json={"firstName": "Jane", "lastName": "Doe"},
            )
        assert response.status_code == 401
    finally:
        get_settings.cache_clear()
