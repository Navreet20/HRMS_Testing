"""Client detail, client options and active allocations: scoped reads in few statements."""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from datetime import date, timedelta
from typing import Any

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, event

from app.db.session import async_session_maker, engine
from app.dependencies import get_current_user
from app.models.tables import Allocation, Client, Employee, Project
from app.modules.clients import router as clients_router
from app.modules.projects import router as projects_router
from tests.helpers import db as _test_db
from tests.helpers.db import DB_SKIP_REASON

SKIP_DB = _test_db.SKIP_DB

# Client (+ locations, stakeholders, invoicing entities, owner), then its projects
# with stakeholders, client stakeholders, allocations and the lookups they need.
MAX_DETAIL_STATEMENTS = 11


def _employee(tag: str, name: str) -> Employee:
    return Employee(
        employee_id=uuid.uuid4(),
        first_name=name,
        last_name=tag,
        department="EMPLOYEE",
        company="Test Co",
        email_id=f"{name.lower()}-{tag}@example.com",
        employment_type="Full-time",
        status="Active",
        employment_start_date="2024-01-01",
    )


def _client(tag: str, name: str, **over: Any) -> Client:
    values: dict[str, Any] = {
        "client_id": uuid.uuid4(),
        "client_status": "ACTIVE",
        "client_name": f"{name} {tag}",
        "client_company_contact_name": "Contact",
        "client_contact_email": "c@example.com",
    }
    values.update(over)
    return Client(**values)


def _allocation(employee: Employee, project: Project, percent: float, start: str, end: str | None) -> Allocation:
    return Allocation(
        allocation_id=uuid.uuid4(),
        employee_id=employee.employee_id,
        project_id=project.project_id,
        role_on_project="Engineer",
        allocation_percentage=percent,
        start_date=start,
        end_date=end,
        billable=False,
    )


class World:
    def __init__(self) -> None:
        self.tag = uuid.uuid4().hex[:8]
        self.ada = _employee(self.tag, "Ada")
        self.bob = _employee(self.tag, "Bob")
        self.mine = _client(self.tag, "Mine")
        self.other = _client(
            self.tag,
            "Other",
            client_status="INACTIVE",
            is_internal=True,
            client_category="internal",
        )
        self.p_mine_1 = Project(project_id=uuid.uuid4(), project_name=f"Mine 1 {self.tag}", client_id=self.mine.client_id)
        self.p_mine_2 = Project(project_id=uuid.uuid4(), project_name=f"Mine 2 {self.tag}", client_id=self.mine.client_id)
        self.p_other = Project(project_id=uuid.uuid4(), project_name=f"Other 1 {self.tag}", client_id=self.other.client_id)


@pytest.fixture
async def world() -> AsyncIterator[World]:
    w = World()
    today = date.today()
    async with async_session_maker() as session:
        session.add_all([w.ada, w.bob, w.mine, w.other])
        await session.flush()
        session.add_all([w.p_mine_1, w.p_mine_2, w.p_other])
        await session.flush()
        session.add_all(
            [
                _allocation(w.ada, w.p_mine_1, 60, "2024-01-01", None),
                _allocation(w.ada, w.p_mine_2, 30, "2024-01-01", (today + timedelta(days=5)).isoformat()),
                _allocation(w.ada, w.p_other, 10, "2023-01-01", "2023-12-31"),
                _allocation(w.bob, w.p_other, 50, "2024-01-01", None),
            ]
        )
        await session.commit()
    yield w
    async with async_session_maker() as session:
        projects = [w.p_mine_1.project_id, w.p_mine_2.project_id, w.p_other.project_id]
        await session.execute(delete(Allocation).where(Allocation.project_id.in_(projects)))
        await session.execute(delete(Project).where(Project.project_id.in_(projects)))
        await session.execute(delete(Client).where(Client.client_id.in_([w.mine.client_id, w.other.client_id])))
        await session.execute(delete(Employee).where(Employee.employee_id.in_([w.ada.employee_id, w.bob.employee_id])))
        await session.commit()


def _client_http(monkeypatch: pytest.MonkeyPatch, *, can_read_projects: bool = True) -> AsyncClient:
    app = FastAPI()
    app.include_router(clients_router.router, prefix="/api/v1/clients")
    app.include_router(projects_router.router, prefix="/api/v1")
    anyone = lambda: {"employeeId": str(uuid.uuid4())}  # noqa: E731
    app.dependency_overrides[clients_router._clients_read] = anyone
    app.dependency_overrides[projects_router._projects_read] = anyone
    app.dependency_overrides[get_current_user] = anyone

    async def _gate(user: Any, db: Any) -> Any:
        if not can_read_projects:
            raise HTTPException(status_code=403, detail="no projects")
        return user

    monkeypatch.setattr(projects_router, "_projects_read", _gate)
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
@pytest.mark.skipif(SKIP_DB, reason=DB_SKIP_REASON)
async def test_detail_returns_only_this_clients_projects(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    statements: list[str] = []

    def _count(conn: Any, cursor: Any, statement: str, *args: Any) -> None:
        statements.append(statement)

    event.listen(engine.sync_engine, "before_cursor_execute", _count)
    try:
        async with _client_http(monkeypatch) as http:
            response = await http.get(f"/api/v1/clients/{world.mine.client_id}/detail")
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", _count)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["client"]["id"] == str(world.mine.client_id)
    assert {row["projectName"] for row in body["projects"]} == {
        f"Mine 1 {world.tag}",
        f"Mine 2 {world.tag}",
    }
    by_name = {row["projectName"]: row for row in body["projects"]}
    allocations = by_name[f"Mine 1 {world.tag}"]["allocations"]
    assert [row["employeeName"] for row in allocations] == [f"Ada {world.tag}"]
    assert len(statements) <= MAX_DETAIL_STATEMENTS, "\n".join(statements)


@pytest.mark.asyncio
@pytest.mark.skipif(SKIP_DB, reason=DB_SKIP_REASON)
async def test_detail_leaves_projects_out_without_project_access(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    async with _client_http(monkeypatch, can_read_projects=False) as http:
        response = await http.get(f"/api/v1/clients/{world.mine.client_id}/detail")
        missing = await http.get(f"/api/v1/clients/{uuid.uuid4()}/detail")
    assert response.status_code == 200
    assert response.json()["projects"] == []
    assert response.json()["client"]["clientName"] == f"Mine {world.tag}"
    assert missing.status_code == 404


@pytest.mark.asyncio
@pytest.mark.skipif(SKIP_DB, reason=DB_SKIP_REASON)
async def test_options_are_light_and_include_every_client(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    async with _client_http(monkeypatch) as http:
        response = await http.get("/api/v1/clients/options")
    assert response.status_code == 200
    rows = {row["id"]: row for row in response.json()}
    assert rows[str(world.mine.client_id)] == {
        "id": str(world.mine.client_id),
        "name": f"Mine {world.tag}",
        "status": "ACTIVE",
        "isInternal": False,
        "clientCategory": "direct",
    }
    assert rows[str(world.other.client_id)]["status"] == "Archived"
    assert rows[str(world.other.client_id)]["isInternal"] is True
    assert rows[str(world.other.client_id)]["clientCategory"] == "internal"


@pytest.mark.asyncio
@pytest.mark.skipif(SKIP_DB, reason=DB_SKIP_REASON)
async def test_active_allocations_skip_ended_ones_and_filter_by_employee(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    async with _client_http(monkeypatch) as http:
        everyone = await http.get("/api/v1/projects/allocations/active")
        ada_only = await http.get(
            "/api/v1/projects/allocations/active",
            params={"employeeIds": [str(world.ada.employee_id)]},
        )
    assert everyone.status_code == 200
    mine = [
        row
        for row in everyone.json()
        if row["employeeId"] in {str(world.ada.employee_id), str(world.bob.employee_id)}
    ]
    # Ada's 2023 allocation has ended; her two running ones and Bob's remain.
    assert sorted((row["employeeId"] == str(world.ada.employee_id), row["allocationPercentage"]) for row in mine) == [
        (False, 50.0),
        (True, 30.0),
        (True, 60.0),
    ]
    assert set(mine[0]) == {
        "allocationId",
        "employeeId",
        "projectId",
        "allocationPercentage",
        "startDate",
        "endDate",
    }
    assert {row["allocationPercentage"] for row in ada_only.json()} == {60.0, 30.0}
