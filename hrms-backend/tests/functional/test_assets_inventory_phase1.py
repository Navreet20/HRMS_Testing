"""Functional coverage for Dev A Phase 1 inventory APIs (mocked service)."""

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
CATEGORY_ID = uuid.uuid4()

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
async def test_patch_asset_descriptive_fields(
    hr_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    updated = {
        "systemAssetId": str(ASSET_ID),
        "assetId": "COG-LAP-0002",
        "categoryId": str(CATEGORY_ID),
        "serialNumber": "SN-UPDATED",
        "osPlatform": "Mac",
        "condition": "Good",
        "specifications": "32GB / 1TB",
        "status": "In Stock",
    }
    mock = AsyncMock(return_value=updated)
    monkeypatch.setattr(assets_service, "update_asset", mock)

    response = await hr_client.patch(
        f"/api/v1/assets/{ASSET_ID}",
        json={
            "serialNumber": "SN-UPDATED",
            "osPlatform": "Mac",
            "condition": "Good",
            "specifications": "32GB / 1TB",
        },
    )
    assert response.status_code == 200
    assert response.json()["serialNumber"] == "SN-UPDATED"
    mock.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_asset_forwards_serial_and_purchase_date(
    hr_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    created = {
        "systemAssetId": str(ASSET_ID),
        "assetId": "COG-LAP-0001",
        "categoryId": str(CATEGORY_ID),
        "serialNumber": "SN-1",
        "purchaseDate": "2026-09-10",
        "status": "In Stock",
    }
    mock = AsyncMock(return_value=created)
    monkeypatch.setattr(assets_service, "create_asset", mock)

    response = await hr_client.post(
        "/api/v1/assets",
        json={
            "categoryId": str(CATEGORY_ID),
            "serialNumber": "SN-1",
            "purchaseDate": "2026-09-10",
        },
    )
    assert response.status_code == 200
    body = mock.await_args.args[2]
    assert body["serialNumber"] == "SN-1"
    assert body["purchaseDate"] == "2026-09-10"


@pytest.mark.asyncio
async def test_create_and_patch_asset_forward_warranty_plan(
    hr_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    created = {
        "systemAssetId": str(ASSET_ID),
        "assetId": "COG-LAP-0001",
        "categoryId": str(CATEGORY_ID),
        "warrantyPlanType": "AppleCare / AppleCare+",
        "warrantyPlan": "AC-19",
        "status": "In Stock",
    }
    create_mock = AsyncMock(return_value=created)
    monkeypatch.setattr(assets_service, "create_asset", create_mock)

    create_response = await hr_client.post(
        "/api/v1/assets",
        json={
            "categoryId": str(CATEGORY_ID),
            "warrantyPlanType": "AppleCare / AppleCare+",
            "warrantyPlan": "AC-19",
        },
    )
    assert create_response.status_code == 200
    assert (
        create_mock.await_args.args[2]["warrantyPlanType"]
        == "AppleCare / AppleCare+"
    )
    assert create_mock.await_args.args[2]["warrantyPlan"] == "AC-19"
    assert create_response.json()["warrantyPlanType"] == "AppleCare / AppleCare+"
    assert create_response.json()["warrantyPlan"] == "AC-19"

    updated = {
        **created,
        "warrantyPlanType": "Store / retailer protection",
        "warrantyPlan": "4412",
    }
    patch_mock = AsyncMock(return_value=updated)
    monkeypatch.setattr(assets_service, "update_asset", patch_mock)
    patch_response = await hr_client.patch(
        f"/api/v1/assets/{ASSET_ID}",
        json={
            "warrantyPlanType": "Store / retailer protection",
            "warrantyPlan": "4412",
        },
    )
    assert patch_response.status_code == 200
    assert (
        patch_mock.await_args.args[-1]["warrantyPlanType"]
        == "Store / retailer protection"
    )
    assert patch_mock.await_args.args[-1]["warrantyPlan"] == "4412"
    assert patch_response.json()["warrantyPlanType"] == "Store / retailer protection"
    assert patch_response.json()["warrantyPlan"] == "4412"


@pytest.mark.asyncio
async def test_create_asset_without_warranty_plan(
    hr_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    created = {
        "systemAssetId": str(ASSET_ID),
        "assetId": "COG-LAP-0001",
        "categoryId": str(CATEGORY_ID),
        "warrantyPlanType": None,
        "warrantyPlan": None,
        "status": "In Stock",
    }
    create_mock = AsyncMock(return_value=created)
    monkeypatch.setattr(assets_service, "create_asset", create_mock)

    create_response = await hr_client.post(
        "/api/v1/assets",
        json={"categoryId": str(CATEGORY_ID)},
    )
    assert create_response.status_code == 200
    body = create_mock.await_args.args[2]
    assert "warrantyPlanType" not in body
    assert "warrantyPlan" not in body
    assert create_response.json()["warrantyPlanType"] is None
    assert create_response.json()["warrantyPlan"] is None


@pytest.mark.asyncio
async def test_create_asset_serial_required_returns_400(
    hr_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from fastapi import HTTPException

    mock = AsyncMock(
        side_effect=HTTPException(
            status_code=400,
            detail="serialNumber is required for category Laptop",
        )
    )
    monkeypatch.setattr(assets_service, "create_asset", mock)

    response = await hr_client.post(
        "/api/v1/assets",
        json={"categoryId": str(CATEGORY_ID)},
    )
    assert response.status_code == 400
    assert "serialNumber is required" in response.json()["detail"]


@pytest.mark.asyncio
async def test_patch_purchase_date_immutable_returns_400(
    hr_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from fastapi import HTTPException

    mock = AsyncMock(
        side_effect=HTTPException(
            status_code=400,
            detail="purchaseDate cannot be changed once it is set",
        )
    )
    monkeypatch.setattr(assets_service, "update_asset", mock)

    response = await hr_client.patch(
        f"/api/v1/assets/{ASSET_ID}",
        json={"purchaseDate": "2026-01-01"},
    )
    assert response.status_code == 400
    assert "cannot be changed" in response.json()["detail"]


@pytest.mark.asyncio
async def test_list_assets_extended_search_params(
    hr_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mock = AsyncMock(return_value=[])
    monkeypatch.setattr(assets_service, "list_assets", mock)

    response = await hr_client.get(
        "/api/v1/assets",
        params={
            "q": "Avery",
            "osPlatform": "Windows",
            "purchaseDateFrom": "2026-01-01",
            "purchaseDateTo": "2026-12-31",
            "warrantyExpiryFrom": "2026-06-01",
            "warrantyExpiryTo": "2027-06-01",
            "categoryId": str(CATEGORY_ID),
            "status": "In Stock",
            "condition": "Good",
        },
    )
    assert response.status_code == 200
    mock.assert_awaited_once()
    kwargs = mock.await_args.kwargs
    assert kwargs["q"] == "Avery"
    assert kwargs["employee_name"] is None
    assert kwargs["os_platform"] == "Windows"
    assert kwargs["purchase_date_from"] == "2026-01-01"
    assert kwargs["purchase_date_to"] == "2026-12-31"
    assert kwargs["warranty_expiry_from"] == "2026-06-01"
    assert kwargs["warranty_expiry_to"] == "2027-06-01"
    assert kwargs["category_id"] == str(CATEGORY_ID)
    assert kwargs["status_filter"] == "In Stock"
    assert kwargs["condition"] == "Good"
    assert kwargs["warranty_expiring_soon"] is False
    assert kwargs["warranty_expired"] is False


@pytest.mark.asyncio
async def test_list_assets_forwards_employee_name(
    hr_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mock = AsyncMock(return_value=[])
    monkeypatch.setattr(assets_service, "list_assets", mock)

    response = await hr_client.get(
        "/api/v1/assets",
        params={"employeeName": "John Doe"},
    )
    assert response.status_code == 200
    mock.assert_awaited_once()
    assert mock.await_args.kwargs["employee_name"] == "John Doe"
    assert mock.await_args.kwargs["q"] is None


@pytest.mark.asyncio
async def test_list_assets_forwards_warranty_expiring_soon(
    hr_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mock = AsyncMock(return_value=[])
    monkeypatch.setattr(assets_service, "list_assets", mock)

    response = await hr_client.get(
        "/api/v1/assets",
        params={
            "warrantyExpiringSoon": "true",
            "warrantyExpiryFrom": "2026-06-01",
            "warrantyExpiryTo": "2027-06-01",
        },
    )
    assert response.status_code == 200
    mock.assert_awaited_once()
    kwargs = mock.await_args.kwargs
    assert kwargs["warranty_expiring_soon"] is True
    assert kwargs["warranty_expiry_from"] == "2026-06-01"
    assert kwargs["warranty_expiry_to"] == "2027-06-01"
    assert kwargs["warranty_expired"] is False


@pytest.mark.asyncio
async def test_list_assets_forwards_warranty_expired(
    hr_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mock = AsyncMock(return_value=[])
    monkeypatch.setattr(assets_service, "list_assets", mock)

    response = await hr_client.get(
        "/api/v1/assets",
        params={"warrantyExpired": "true"},
    )
    assert response.status_code == 200
    mock.assert_awaited_once()
    kwargs = mock.await_args.kwargs
    assert kwargs["warranty_expired"] is True
    assert kwargs["warranty_expiring_soon"] is False


@pytest.mark.asyncio
async def test_list_categories(
    hr_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mock = AsyncMock(
        return_value=[
            {
                "categoryId": str(CATEGORY_ID),
                "categoryName": "Laptop",
            }
        ]
    )
    monkeypatch.setattr(assets_service, "list_categories", mock)

    response = await hr_client.get("/api/v1/assets/categories")
    assert response.status_code == 200
    mock.assert_awaited_once()
    assert response.json()[0]["categoryName"] == "Laptop"


@pytest.mark.asyncio
async def test_return_to_stock_route(
    hr_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mock = AsyncMock(
        return_value={
            "systemAssetId": str(ASSET_ID),
            "assetId": "COG-LAP-0002",
            "status": "In Stock",
        }
    )
    monkeypatch.setattr(assets_service, "return_asset_to_stock", mock)
    response = await hr_client.post(f"/api/v1/assets/{ASSET_ID}/return-to-stock")
    assert response.status_code == 200
    mock.assert_awaited_once()
    assert response.json()["status"] == "In Stock"
