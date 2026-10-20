"""Functional coverage for assign → return lifecycle (mocked service)."""

from __future__ import annotations

import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.db.session import get_db
from app.dependencies import get_current_user
from app.modules.assets import router as assets_router
from app.modules.assets import service as assets_service

HR_ID = uuid.uuid4()
ASSET_ID = uuid.uuid4()
ALLOCATION_ID = uuid.uuid4()
EMPLOYEE_ID = uuid.uuid4()

HR_USER = {
    "employeeId": str(HR_ID),
    "id": str(HR_ID),
    "emailId": "hr@example.com",
    "department": "HR",
    "role": "HR",
    "firstName": "Pat",
    "lastName": "HR",
    "viewAccess": True,
    "editAccess": True,
    "fullAccess": False,
    "createAccess": True,
}


def _build_app(user: dict[str, Any]) -> FastAPI:
    app = FastAPI()
    app.include_router(assets_router.router, prefix="/api/v1")

    async def _user() -> dict[str, Any]:
        return user

    async def _db() -> Any:
        yield MagicMock()

    app.dependency_overrides[get_current_user] = _user
    app.dependency_overrides[get_db] = _db
    return app


@pytest.fixture
async def hr_client() -> AsyncClient:
    app = _build_app(HR_USER)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.mark.asyncio
async def test_assign_return_activity_flow(
    hr_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    allocate_payload = {
        "allocationId": str(ALLOCATION_ID),
        "systemAssetId": str(ASSET_ID),
        "employeeId": str(EMPLOYEE_ID),
        "asset": {
            "systemAssetId": str(ASSET_ID),
            "assetId": "COG-LAP-0001",
            "status": "Assigned",
            "openAllocationId": str(ALLOCATION_ID),
        },
    }
    return_payload = {
        **allocate_payload,
        "returnedDate": "2026-09-12",
        "asset": {
            "systemAssetId": str(ASSET_ID),
            "assetId": "COG-LAP-0001",
            "status": "Under Repair",
            "openAllocationId": None,
        },
    }
    activity_payload = [
        {
            "logId": str(uuid.uuid4()),
            "systemAssetId": str(ASSET_ID),
            "actionType": "Assigned",
            "performedBy": str(HR_ID),
            "actionDate": "2026-09-11T12:00:00+00:00",
            "notes": "Assigned to Avery",
        },
        {
            "logId": str(uuid.uuid4()),
            "systemAssetId": str(ASSET_ID),
            "actionType": "Under Repair",
            "performedBy": str(HR_ID),
            "actionDate": "2026-09-12T12:00:00+00:00",
            "notes": "Under Repair (Broken)",
        },
    ]

    monkeypatch.setattr(
        assets_service,
        "allocate_asset",
        AsyncMock(return_value=allocate_payload),
    )
    monkeypatch.setattr(
        assets_service,
        "return_allocation",
        AsyncMock(return_value=return_payload),
    )
    monkeypatch.setattr(
        assets_service,
        "list_asset_activity",
        AsyncMock(return_value=activity_payload),
    )

    allocate = await hr_client.post(
        f"/api/v1/assets/{ASSET_ID}/allocate",
        json={"employeeId": str(EMPLOYEE_ID)},
    )
    assert allocate.status_code == 200
    assert allocate.json()["asset"]["status"] == "Assigned"

    returned = await hr_client.post(
        f"/api/v1/assets/allocations/{ALLOCATION_ID}/return",
        json={
            "reasonForReturn": "Broken",
            "conditionAtReturn": "Poor",
        },
    )
    assert returned.status_code == 200
    assert returned.json()["asset"]["status"] == "Under Repair"

    activity = await hr_client.get(f"/api/v1/assets/{ASSET_ID}/activity")
    assert activity.status_code == 200
    assert [row["actionType"] for row in activity.json()] == ["Assigned", "Under Repair"]


@pytest.mark.asyncio
async def test_acknowledgment_and_fifo_routes_removed(
    hr_client: AsyncClient,
) -> None:
    ack = await hr_client.patch(
        f"/api/v1/assets/allocations/{ALLOCATION_ID}/acknowledgment",
        json={"acknowledgmentSigned": True},
    )
    assert ack.status_code in {404, 405}

    suggest = await hr_client.get(
        f"/api/v1/assets/suggest?categoryId={uuid.uuid4()}"
    )
    assert suggest.status_code in {404, 405}


@pytest.mark.asyncio
async def test_return_without_reason_rejected_by_service_contract(
    hr_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from fastapi import HTTPException, status

    async def _boom(*_args: Any, **_kwargs: Any) -> dict:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="reasonForReturn is required",
        )

    monkeypatch.setattr(assets_service, "return_allocation", _boom)
    response = await hr_client.post(
        f"/api/v1/assets/allocations/{ALLOCATION_ID}/return",
        json={"conditionAtReturn": "Good"},
    )
    assert response.status_code == 400
    assert "reasonForReturn" in response.json()["detail"]


@pytest.mark.asyncio
async def test_swap_asset_route_success(
    hr_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    new_asset_id = uuid.uuid4()
    new_allocation_id = uuid.uuid4()
    swap_payload = {
        "swapped": True,
        "returned": {
            "allocationId": str(ALLOCATION_ID),
            "systemAssetId": str(ASSET_ID),
            "employeeId": str(EMPLOYEE_ID),
            "returnedDate": "2026-09-12",
            "swappedWithAllocationId": str(new_allocation_id),
            "asset": {
                "systemAssetId": str(ASSET_ID),
                "assetId": "COG-LAP-0001",
                "status": "Under Repair",
            },
        },
        "allocated": {
            "allocationId": str(new_allocation_id),
            "systemAssetId": str(new_asset_id),
            "employeeId": str(EMPLOYEE_ID),
            "swappedWithAllocationId": str(ALLOCATION_ID),
            "asset": {
                "systemAssetId": str(new_asset_id),
                "assetId": "COG-LAP-0002",
                "status": "Assigned",
                "openAllocationId": str(new_allocation_id),
            },
        },
    }
    mock_swap = AsyncMock(return_value=swap_payload)
    monkeypatch.setattr(assets_service, "swap_asset", mock_swap)

    response = await hr_client.post(
        f"/api/v1/assets/allocations/{ALLOCATION_ID}/swap",
        json={
            "systemAssetId": str(new_asset_id),
            "reasonForReturn": "Broken",
            "conditionAtReturn": "Poor",
            "returnNotes": "Screen cracked; swapping to spare",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["swapped"] is True
    assert body["returned"]["asset"]["status"] == "Under Repair"
    assert body["allocated"]["asset"]["status"] == "Assigned"
    assert body["returned"]["swappedWithAllocationId"] == str(new_allocation_id)
    assert body["allocated"]["swappedWithAllocationId"] == str(ALLOCATION_ID)
    mock_swap.assert_awaited_once()
    call_args = mock_swap.await_args
    assert call_args.args[2] == ALLOCATION_ID
    assert call_args.args[3]["systemAssetId"] == str(new_asset_id)


@pytest.mark.asyncio
async def test_swap_rejects_when_new_asset_not_in_stock(
    hr_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from fastapi import HTTPException, status

    async def _boom(*_args: Any, **_kwargs: Any) -> dict:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Asset must be In Stock to assign",
        )

    monkeypatch.setattr(assets_service, "swap_asset", _boom)
    response = await hr_client.post(
        f"/api/v1/assets/allocations/{ALLOCATION_ID}/swap",
        json={
            "systemAssetId": str(uuid.uuid4()),
            "reasonForReturn": "Other",
            "reasonForReturnOther": "Upgrade",
            "conditionAtReturn": "Good",
        },
    )
    assert response.status_code == 400
    assert "In Stock" in response.json()["detail"]
