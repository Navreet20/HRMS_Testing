"""ESS-DATA-5 functional Manage request queues (read-only)."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.modules.employee.service import EmployeeService


def _request_row(
    *,
    employee_id,
    first_name: str = "Ada",
    last_name: str = "Lovelace",
) -> MagicMock:
    emp = MagicMock()
    emp.first_name = first_name
    emp.last_name = last_name
    row = MagicMock()
    row.id = uuid4()
    row.employee_id = employee_id
    row.employee = emp
    row.status = "Open"
    row.requested_date = datetime(2026, 9, 16, tzinfo=timezone.utc)
    row.created_date = row.requested_date
    row.updated_date = row.requested_date
    return row


@pytest.mark.asyncio
async def test_list_manage_profile_update_requests_forbidden_for_employee() -> None:
    session = AsyncMock()
    with pytest.raises(HTTPException) as exc:
        await EmployeeService().list_manage_profile_update_requests(
            session, {"role": "EMPLOYEE", "employeeId": str(uuid4())}
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_list_manage_profile_update_requests_for_hr() -> None:
    session = AsyncMock()
    employee_id = uuid4()
    row = _request_row(employee_id=employee_id)
    row.field_changed = "firstName"
    row.old_value = "Ada"
    row.new_value = "Augusta"
    result = MagicMock()
    result.scalars.return_value.all.return_value = [row]
    session.execute = AsyncMock(return_value=result)

    items = await EmployeeService().list_manage_profile_update_requests(
        session, {"role": "HR", "employeeId": str(uuid4())}
    )

    assert len(items) == 1
    assert items[0]["fieldChanged"] == "firstName"
    assert items[0]["requesterName"] == "Ada Lovelace"
    assert items[0]["employeeId"] == str(employee_id)


@pytest.mark.asyncio
async def test_list_manage_asset_requests_for_admin() -> None:
    session = AsyncMock()
    employee_id = uuid4()
    row = _request_row(employee_id=employee_id)
    row.request_type = "new"
    row.system_asset_id = None
    row.new_asset_details = "Laptop"
    result = MagicMock()
    result.scalars.return_value.all.return_value = [row]
    session.execute = AsyncMock(return_value=result)

    items = await EmployeeService().list_manage_asset_requests(
        session, {"role": "ADMIN", "employeeId": str(uuid4())}
    )

    assert len(items) == 1
    assert items[0]["requestType"] == "new"
    assert items[0]["requesterName"] == "Ada Lovelace"


@pytest.mark.asyncio
async def test_list_manage_it_requests_forbidden_for_employee() -> None:
    session = AsyncMock()
    with pytest.raises(HTTPException) as exc:
        await EmployeeService().list_manage_it_requests(
            session, {"role": "EMPLOYEE", "employeeId": str(uuid4())}
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_list_manage_it_requests_for_superadmin() -> None:
    session = AsyncMock()
    employee_id = uuid4()
    row = _request_row(employee_id=employee_id)
    row.category = "firewall"
    row.details = "Open port 443"
    result = MagicMock()
    result.scalars.return_value.all.return_value = [row]
    session.execute = AsyncMock(return_value=result)

    items = await EmployeeService().list_manage_it_requests(
        session, {"role": "SUPERADMIN", "employeeId": str(uuid4())}
    )

    assert len(items) == 1
    assert items[0]["category"] == "firewall"
    assert items[0]["requesterName"] == "Ada Lovelace"
