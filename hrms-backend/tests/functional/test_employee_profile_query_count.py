"""GET /employees/{id} loads a profile in a small, fixed number of SQL statements."""

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
from app.modules.employee import router as employees_router
from tests.helpers import db as _test_db
from tests.helpers.db import DB_SKIP_REASON

SKIP_DB = _test_db.SKIP_DB

# Exactly what the profile needs: employee (+ org joins), grants (2), address,
# emergency contact, pending change, onboarding, manager name.
MAX_PROFILE_STATEMENTS = 9


def _employee(**over: Any) -> Employee:
    tag = uuid.uuid4().hex[:8]
    values: dict[str, Any] = {
        "employee_id": uuid.uuid4(),
        "first_name": "Query",
        "last_name": tag,
        "department": "EMPLOYEE",
        "company": "Test Co",
        "email_id": f"qc-{tag}@example.com",
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
    report = _employee(reporting_manager_id=manager.employee_id)
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
    app.include_router(employees_router.router, prefix="/api/v1")

    async def _user() -> dict[str, Any]:
        return user

    app.dependency_overrides[get_current_user] = _user
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
@pytest.mark.skipif(SKIP_DB, reason=DB_SKIP_REASON)
async def test_profile_uses_few_statements(people: tuple[Employee, Employee]) -> None:
    _, report = people
    hr = {
        "employeeId": str(uuid.uuid4()),
        "emailId": "hr-qc@example.com",
        "department": "HR",
        "viewAccess": True,
    }
    statements: list[str] = []

    def _count(conn: Any, cursor: Any, statement: str, *args: Any) -> None:
        statements.append(statement)

    event.listen(engine.sync_engine, "before_cursor_execute", _count)
    try:
        async with _client(hr) as client:
            response = await client.get(f"/api/v1/employees/{report.employee_id}")
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", _count)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["reportingManagerName"].startswith("Boss")
    assert body["inviteOutstanding"] is True
    assert len(statements) <= MAX_PROFILE_STATEMENTS, "\n".join(statements)
