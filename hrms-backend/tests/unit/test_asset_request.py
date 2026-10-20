"""ESS-DATA-3 asset request service."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.modules.employee.service import EmployeeService


@pytest.mark.asyncio
async def test_create_asset_request_rejects_bad_type() -> None:
    session = AsyncMock()
    with pytest.raises(HTTPException) as exc:
        await EmployeeService().create_asset_request(
            session,
            {"employeeId": str(uuid4())},
            {"requestType": "repair", "newAssetDetails": "x"},
        )
    assert exc.value.status_code == 400
    assert "requestType" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_create_new_asset_request_requires_details() -> None:
    session = AsyncMock()
    cat_id = uuid4()
    cat = MagicMock()
    cat.category_id = cat_id
    cat.category_name = "Laptop"
    cat_result = MagicMock()
    cat_result.scalar_one_or_none.return_value = cat
    session.execute = AsyncMock(return_value=cat_result)
    with pytest.raises(HTTPException) as exc:
        await EmployeeService().create_asset_request(
            session,
            {"employeeId": str(uuid4())},
            {"requestType": "new", "categoryId": str(cat_id)},
        )
    assert exc.value.status_code == 400
    assert "newAssetDetails" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_create_new_asset_request_requires_category() -> None:
    session = AsyncMock()
    with pytest.raises(HTTPException) as exc:
        await EmployeeService().create_asset_request(
            session,
            {"employeeId": str(uuid4())},
            {"requestType": "new", "newAssetDetails": "Need a laptop"},
        )
    assert exc.value.status_code == 400
    assert "categoryId" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_create_swap_requires_assigned_asset() -> None:
    session = AsyncMock()
    result = MagicMock()
    result.first.return_value = None
    session.execute = AsyncMock(return_value=result)
    asset_id = uuid4()
    with pytest.raises(HTTPException) as exc:
        await EmployeeService().create_asset_request(
            session,
            {"employeeId": str(uuid4())},
            {
                "requestType": "swap",
                "systemAssetId": str(asset_id),
                "newAssetDetails": "Need a lighter laptop",
            },
        )
    assert exc.value.status_code == 400
    assert "assigned" in str(exc.value.detail).lower()


@pytest.mark.asyncio
async def test_create_new_asset_request_persists_and_notifies() -> None:
    session = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    employee_id = uuid4()
    cat_id = uuid4()
    emp = MagicMock()
    emp.first_name = "Alex"
    emp.last_name = "Morgan"
    emp.email_id = "alex@example.com"
    emp.business_employee_id = "E1"
    emp.employee_code = "E1"
    cat = MagicMock()
    cat.category_id = cat_id
    cat.category_name = "Laptop"
    cat_result = MagicMock()
    cat_result.scalar_one_or_none.return_value = cat
    session.execute = AsyncMock(return_value=cat_result)

    svc = EmployeeService()
    svc._get = AsyncMock(return_value=emp)  # type: ignore[method-assign]

    with patch(
        "app.modules.employee.asset_request_notify.notify_asset_manager_asset_request",
        new_callable=AsyncMock,
    ) as notify:
        payload = await svc.create_asset_request(
            session,
            {"employeeId": str(employee_id)},
            {
                "requestType": "new",
                "categoryId": str(cat_id),
                "newAssetDetails": "Laptop 14 inch",
            },
        )

    assert payload["requestType"] == "new"
    assert payload["newAssetDetails"] == "Laptop 14 inch"
    assert payload["systemAssetId"] is None
    assert payload["categoryId"] == str(cat_id)
    assert payload["categoryName"] == "Laptop"
    assert payload["status"] == "Open"
    assert payload["employeeId"] == str(employee_id)
    assert session.add.call_count == 2  # the request, then its timeline entry
    notify.assert_awaited_once()
    assert notify.await_args.kwargs["category_name"] == "Laptop"


@pytest.mark.asyncio
async def test_create_swap_asset_request_persists_and_notifies() -> None:
    session = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    employee_id = uuid4()
    system_asset_id = uuid4()
    emp = MagicMock()
    emp.first_name = "Alex"
    emp.last_name = "Morgan"
    emp.email_id = "alex@example.com"
    emp.business_employee_id = "E1"
    emp.employee_code = "E1"
    allocation = MagicMock()
    asset = MagicMock()
    asset.asset_id = "COG-LAP-0001"
    result = MagicMock()
    result.first.return_value = (allocation, asset)
    session.execute = AsyncMock(return_value=result)

    svc = EmployeeService()
    svc._get = AsyncMock(return_value=emp)  # type: ignore[method-assign]

    with patch(
        "app.modules.employee.asset_request_notify.notify_asset_manager_asset_request",
        new_callable=AsyncMock,
    ) as notify:
        payload = await svc.create_asset_request(
            session,
            {"employeeId": str(employee_id)},
            {
                "requestType": "swap",
                "systemAssetId": str(system_asset_id),
                "newAssetDetails": "Screen cracked, need replacement",
            },
        )

    assert payload["requestType"] == "swap"
    assert payload["systemAssetId"] == str(system_asset_id)
    assert payload["newAssetDetails"] == "Screen cracked, need replacement"
    assert payload["status"] == "Open"
    notify.assert_awaited_once()
    assert notify.await_args.kwargs["asset_code"] == "COG-LAP-0001"


@pytest.mark.asyncio
async def test_create_lost_stolen_requires_description() -> None:
    session = AsyncMock()
    employee_id = uuid4()
    system_asset_id = uuid4()
    allocation = MagicMock()
    asset = MagicMock()
    asset.asset_id = "COG-LAP-0002"
    result = MagicMock()
    result.first.return_value = (allocation, asset)
    session.execute = AsyncMock(return_value=result)

    with pytest.raises(HTTPException) as exc:
        await EmployeeService().create_asset_request(
            session,
            {"employeeId": str(employee_id)},
            {
                "requestType": "reportLostStolen",
                "systemAssetId": str(system_asset_id),
            },
        )
    assert exc.value.status_code == 400
    assert "newAssetDetails" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_create_asset_request_on_behalf() -> None:
    session = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    actor_id = uuid4()
    subject_id = uuid4()
    system_asset_id = uuid4()
    actor = MagicMock()
    actor.first_name = "Riley"
    actor.last_name = "Requester"
    actor.email_id = "riley@example.com"
    actor.business_employee_id = "E1"
    actor.employee_code = "E1"
    subject = MagicMock()
    subject.first_name = "Sam"
    subject.last_name = "Subject"
    subject.email_id = "sam@example.com"
    subject.business_employee_id = "E2"
    subject.employee_code = "E2"
    allocation = MagicMock()
    asset = MagicMock()
    asset.asset_id = "COG-LAP-0003"
    result = MagicMock()
    result.first.return_value = (allocation, asset)
    session.execute = AsyncMock(return_value=result)

    svc = EmployeeService()
    svc._get = AsyncMock(side_effect=[subject, actor])  # type: ignore[method-assign]

    with patch(
        "app.modules.employee.asset_request_notify.notify_asset_manager_asset_request",
        new_callable=AsyncMock,
    ):
        payload = await svc.create_asset_request(
            session,
            {"employeeId": str(actor_id)},
            {
                "requestType": "reportLostStolen",
                "systemAssetId": str(system_asset_id),
                "newAssetDetails": "Left on train",
                "requestedForEmployeeId": str(subject_id),
            },
        )

    row = session.add.call_args_list[0].args[0]
    assert row.employee_id == subject_id
    assert row.submitted_by_employee_id == actor_id
    assert payload["employeeId"] == str(subject_id)
    assert payload["submittedByEmployeeId"] == str(actor_id)
    assert payload["newAssetDetails"] == "Left on train"


@pytest.mark.asyncio
async def test_create_asset_request_requires_employee_id() -> None:
    session = AsyncMock()
    with pytest.raises(HTTPException) as exc:
        await EmployeeService().create_asset_request(
            session, {}, {"requestType": "new", "newAssetDetails": "Monitor"}
        )
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_list_own_asset_requests() -> None:
    session = AsyncMock()
    employee_id = uuid4()
    row = MagicMock()
    row.id = uuid4()
    row.employee_id = employee_id
    row.request_type = "new"
    row.system_asset_id = None
    row.new_asset_details = "Dock"
    row.status = "Open"
    row.requested_date = None
    row.created_date = None
    row.updated_date = None
    result = MagicMock()
    result.scalars.return_value.all.return_value = [row]
    session.execute = AsyncMock(return_value=result)

    items = await EmployeeService().list_own_asset_requests(
        session, {"employeeId": str(employee_id)}
    )
    assert len(items) == 1
    assert items[0]["requestType"] == "new"
    assert items[0]["newAssetDetails"] == "Dock"


@pytest.mark.asyncio
async def test_decide_asset_request_rejects() -> None:
    session = AsyncMock()
    request_id = uuid4()
    row = MagicMock()
    row.id = request_id
    row.status = "Open"
    row.employee_id = uuid4()
    row.request_type = "new"
    row.system_asset_id = None
    row.new_asset_details = "Dock"
    row.requested_date = None
    row.created_date = None
    row.updated_date = None
    row.requested_category_id = None
    row.requested_category = None
    row.employee = MagicMock()
    row.employee.first_name = "Ada"
    row.employee.last_name = "Lovelace"
    row.employee.business_employee_id = "E1"
    row.employee.employee_code = "E1"
    row.submitted_by_employee_id = None
    row.submitted_by_employee = None
    result = MagicMock()
    result.scalar_one_or_none.return_value = row
    session.execute = AsyncMock(return_value=result)
    session.flush = AsyncMock()

    svc = EmployeeService()
    svc._require_functional_queue_access = MagicMock()  # type: ignore[method-assign]
    with patch(
        "app.modules.employee.request_decision_notify.notify_request_decision",
        new_callable=AsyncMock,
    ):
        payload = await svc.decide_asset_request(
            session,
            {"employeeId": str(uuid4())},
            request_id,
            {"action": "reject", "notes": "Not in stock"},
        )
    assert row.status == "Rejected"
    assert payload["status"] == "Rejected"
    assert row.decision_note == "Not in stock"

