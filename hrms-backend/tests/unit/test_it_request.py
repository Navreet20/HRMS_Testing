"""ESS-DATA-4 IT request service."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.modules.employee.service import EmployeeService


@pytest.mark.asyncio
async def test_create_it_request_rejects_bad_category() -> None:
    session = AsyncMock()
    with pytest.raises(HTTPException) as exc:
        await EmployeeService().create_it_request(
            session,
            {"employeeId": str(uuid4())},
            {"category": "vpn", "details": "Need access"},
        )
    assert exc.value.status_code == 400
    assert "category" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_create_it_request_rejects_empty_details() -> None:
    session = AsyncMock()
    with pytest.raises(HTTPException) as exc:
        await EmployeeService().create_it_request(
            session,
            {"employeeId": str(uuid4())},
            {"category": "firewall", "details": "  "},
        )
    assert exc.value.status_code == 400
    assert "details" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_create_it_request_persists_and_notifies() -> None:
    session = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    employee_id = uuid4()
    emp = MagicMock()
    emp.first_name = "Alex"
    emp.last_name = "Morgan"
    emp.email_id = "alex@example.com"
    emp.business_employee_id = "E1"
    emp.employee_code = "E1"

    svc = EmployeeService()
    svc._get = AsyncMock(return_value=emp)  # type: ignore[method-assign]

    with patch(
        "app.modules.employee.it_request_notify.notify_it_request",
        new_callable=AsyncMock,
    ) as notify:
        payload = await svc.create_it_request(
            session,
            {"employeeId": str(employee_id)},
            {
                "category": "softwareLicense",
                "details": "Need Jira access for Project X",
            },
        )

    assert payload["category"] == "softwareLicense"
    assert payload["details"] == "Need Jira access for Project X"
    assert payload["status"] == "Open"
    assert payload["employeeId"] == str(employee_id)
    session.add.assert_called_once()
    notify.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_it_request_requires_employee_id() -> None:
    session = AsyncMock()
    with pytest.raises(HTTPException) as exc:
        await EmployeeService().create_it_request(
            session, {}, {"category": "ram", "details": "16GB upgrade"}
        )
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_list_own_it_requests() -> None:
    session = AsyncMock()
    employee_id = uuid4()
    row = MagicMock()
    row.id = uuid4()
    row.employee_id = employee_id
    row.category = "firewall"
    row.details = "Open port 443"
    row.status = "Open"
    row.requested_date = None
    row.created_date = None
    row.updated_date = None
    result = MagicMock()
    result.scalars.return_value.all.return_value = [row]
    session.execute = AsyncMock(return_value=result)

    items = await EmployeeService().list_own_it_requests(
        session, {"employeeId": str(employee_id)}
    )
    assert len(items) == 1
    assert items[0]["category"] == "firewall"
    assert items[0]["details"] == "Open port 443"
