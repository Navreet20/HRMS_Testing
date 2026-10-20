"""Functional coverage for read-only employee profile audit trail API."""

from __future__ import annotations

import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

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
    "viewAccess": True,
    "editAccess": True,
    "fullAccess": True,
    "createAccess": True,
}

EMPLOYEE_USER = {
    "employeeId": str(uuid.uuid4()),
    "emailId": "worker@example.com",
    "department": "EMPLOYEE",
    "role": "EMPLOYEE",
    "firstName": "John",
    "lastName": "Smith",
    "viewAccess": False,
    "editAccess": False,
    "fullAccess": False,
    "createAccess": False,
}


def _build_app(user: dict[str, Any]) -> FastAPI:
    app = FastAPI()
    app.include_router(employees_router.router, prefix="/api/v1")

    async def _user() -> dict[str, Any]:
        return user

    async def _db() -> Any:
        yield MagicMock()

    app.dependency_overrides[get_current_user] = _user
    app.dependency_overrides[get_db] = _db
    return app


@pytest.mark.asyncio
async def test_audit_trail_forbidden_for_employee() -> None:
    transport = ASGITransport(app=_build_app(EMPLOYEE_USER))
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/employees/audit-trail")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_audit_trail_lists_for_hr(monkeypatch: pytest.MonkeyPatch) -> None:
    payload = {
        "items": [
            {
                "id": str(uuid.uuid4()),
                "employeeId": str(uuid.uuid4()),
                "employeeCode": "ADA-001",
                "businessEmployeeId": "EMP10042",
                "employeeName": "Ada Lovelace",
                "fieldName": "phoneNumber",
                "oldValue": "111",
                "newValue": "222",
                "changedBy": "Ada Lovelace",
                "changedById": str(uuid.uuid4()),
                "changedByRole": "EMPLOYEE",
                "reason": None,
                "changedAt": "2026-08-31T12:00:00+00:00",
            }
        ],
        "total": 1,
        "page": 1,
        "pageSize": 50,
    }
    monkeypatch.setattr(
        employees_router._svc,
        "list_field_audit",
        AsyncMock(return_value=payload),
    )

    transport = ASGITransport(app=_build_app(HR_USER))
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/api/v1/employees/audit-trail?q=Ada&fromDate=2026-09-01&toDate=2026-09-02"
        )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["employeeName"] == "Ada Lovelace"
    assert body["items"][0]["changedByRole"] == "EMPLOYEE"
    employees_router._svc.list_field_audit.assert_awaited_once()
    call_kwargs = employees_router._svc.list_field_audit.await_args.kwargs
    assert call_kwargs["q"] == "Ada"
    assert str(call_kwargs["from_date"]) == "2026-09-01"
    assert str(call_kwargs["to_date"]) == "2026-09-02"
