"""Project list rows are built with a fixed number of queries, not one set per project."""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.modules.projects import service as svc


def _project(client_id: uuid.UUID | None) -> SimpleNamespace:
    return SimpleNamespace(
        project_id=uuid.uuid4(),
        client_id=client_id,
        project_code="P",
        project_display_id="PRJ-1",
        project_type=None,
        region=None,
        billing_type=None,
        project_enddate=None,
        actual_end_date=None,
    )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_payloads_group_rows_per_project_with_one_load_each(monkeypatch):
    client_id = uuid.uuid4()
    first, second, third = _project(client_id), _project(client_id), _project(None)
    projects = [first, second, third]

    managers = {"employeeId": "m1", "displayName": "Mia", "role": "PROJECT_MANAGER"}
    owner = {"employeeId": "o1", "displayName": "Omar", "role": "ACCOUNT_OWNER"}
    stakeholders = AsyncMock(
        return_value={
            first.project_id: ([managers], [owner]),
            second.project_id: ([], []),
            third.project_id: ([], []),
        }
    )
    client_rows = AsyncMock(
        return_value={p.project_id: [{"id": str(i)}] for i, p in enumerate(projects)}
    )
    allocations = AsyncMock(
        return_value={
            first.project_id: [{"id": "a1"}],
            second.project_id: [],
            third.project_id: [],
        }
    )
    monkeypatch.setattr(svc, "_load_stakeholders_many", stakeholders)
    monkeypatch.setattr(svc, "_load_client_stakeholders_many", client_rows)
    monkeypatch.setattr(svc, "_load_allocations_many", allocations)
    monkeypatch.setattr(svc, "project_to_dict", lambda p: {"projectId": str(p.project_id)})

    customer = SimpleNamespace(
        client_id=client_id,
        client_name="Acme",
        is_internal=False,
        client_category="intermediary",
    )
    result = MagicMock()
    result.scalars.return_value.all.return_value = [customer]
    db = MagicMock()
    db.execute = AsyncMock(return_value=result)

    rows = await svc._project_payloads(db, projects)

    for loader in (stakeholders, client_rows, allocations):
        loader.assert_awaited_once()
    assert db.execute.await_count == 1  # one client lookup for all projects
    assert [r["projectId"] for r in rows] == [str(p.project_id) for p in projects]
    assert rows[0]["clientName"] == "Acme"
    assert rows[0]["isInternalClient"] is False
    assert rows[0]["clientCategory"] == "intermediary"
    assert rows[2]["clientCategory"] is None
    assert rows[0]["projectManagerIds"] == ["m1"]
    assert rows[0]["accountOwnerIds"] == ["o1"]
    assert rows[0]["allocations"] == [{"id": "a1"}]
    assert rows[2]["clientName"] is None and rows[2]["isInternalClient"] is None
    assert rows[1]["allocations"] == []
