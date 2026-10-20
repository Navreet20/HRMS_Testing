"""GET /auth/bootstrap: one call for the shell, in a fixed number of statements."""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, event

from app.core.config import get_settings
from app.db.session import async_session_maker, engine
from app.dependencies import get_current_user
from app.models.tables import Employee
from app.modules.auth import router as auth_router
from tests.helpers import db as _test_db
from tests.helpers.db import DB_SKIP_REASON

SKIP_DB = _test_db.SKIP_DB

# Measured on the test database: 13 without a session token in the claims, 14
# with one (the saved view). Employee (+ org joins), skills, access row, company
# by name, grants (2), managing option, onboarding, address, emergency contact,
# pending change, manager name, current company, queue count.
MAX_BOOTSTRAP_STATEMENTS = 14


def _employee(**over: Any) -> Employee:
    tag = uuid.uuid4().hex[:8]
    values: dict[str, Any] = {
        "employee_id": uuid.uuid4(),
        "first_name": "Boot",
        "last_name": tag,
        "department": "HR",
        "company": "Test Co",
        "email_id": f"boot-{tag}@example.com",
        "employment_type": "Full-time",
        "status": "Active",
        "employment_start_date": "2024-01-01",
    }
    values.update(over)
    return Employee(**values)


@pytest.fixture(autouse=True)
def _auth_bypass_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AUTH_BYPASS", "false")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
async def people() -> AsyncIterator[tuple[Employee, Employee]]:
    manager = _employee(first_name="Boss")
    report = _employee(reporting_manager_id=manager.employee_id, department="EMPLOYEE")
    async with async_session_maker() as session:
        session.add(manager)
        await session.flush()
        session.add(report)
        await session.commit()
    yield manager, report
    async with async_session_maker() as session:
        await session.execute(
            delete(Employee).where(
                Employee.employee_id.in_([report.employee_id, manager.employee_id])
            )
        )
        await session.commit()


def _client(user: dict[str, Any]) -> AsyncClient:
    app = FastAPI()
    app.include_router(auth_router.router)

    async def _user() -> dict[str, Any]:
        return user

    app.dependency_overrides[get_current_user] = _user
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _get_counted(user: dict[str, Any]) -> tuple[Any, list[str]]:
    statements: list[str] = []

    def _count(conn: Any, cursor: Any, statement: str, *args: Any) -> None:
        statements.append(statement)

    event.listen(engine.sync_engine, "before_cursor_execute", _count)
    try:
        async with _client(user) as client:
            response = await client.get("/api/v1/auth/bootstrap")
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", _count)
    return response, statements


@pytest.mark.asyncio
@pytest.mark.skipif(SKIP_DB, reason=DB_SKIP_REASON)
async def test_bootstrap_returns_everything_in_few_statements(
    people: tuple[Employee, Employee],
) -> None:
    manager, report = people
    user = {
        "employeeId": str(manager.employee_id),
        "emailId": manager.email_id,
        "department": "HR",
        "role": "HR",
    }
    response, statements = await _get_counted(user)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["userDetails"]["employeeId"] == str(manager.employee_id)
    assert body["profile"]["employeeId"] == str(manager.employee_id)
    assert body["managingOption"]["hasDirectReports"] is True
    assert body["queueCount"] == 0
    assert {"views", "company"} <= body.keys()
    assert len(statements) <= MAX_BOOTSTRAP_STATEMENTS, "\n".join(statements)


@pytest.mark.asyncio
@pytest.mark.skipif(SKIP_DB, reason=DB_SKIP_REASON)
async def test_bootstrap_hides_company_without_access(
    people: tuple[Employee, Employee],
) -> None:
    _, report = people
    user = {
        "employeeId": str(report.employee_id),
        "emailId": report.email_id,
        "department": "EMPLOYEE",
        "role": "EMPLOYEE",
    }
    response, statements = await _get_counted(user)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["company"] is None
    assert body["profile"]["reportingManagerName"].startswith("Boss")
    assert body["managingOption"]["hasDirectReports"] is False
    assert len(statements) <= MAX_BOOTSTRAP_STATEMENTS, "\n".join(statements)
