"""Asset purchase-receipt upload / replace / download (MinIO object on ASSET)."""

from __future__ import annotations

import io
import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.db.session import get_db
from app.dependencies import get_current_user
from app.modules.assets import router as assets_router
from app.modules.assets import service as assets_service

HR_ID = uuid.uuid4()
ASSET_ID = uuid.uuid4()

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


@pytest.fixture
def storage():
    mock = MagicMock()
    mock.put_bytes = MagicMock()
    mock.get_bytes = MagicMock(return_value=(b"%PDF-bytes", "application/pdf"))
    mock.remove = MagicMock()
    with patch("app.modules.assets.router.get_storage", return_value=mock):
        yield mock


@pytest.mark.asyncio
async def test_create_asset_succeeds_without_purchase_receipt(
    hr_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    created = {
        "systemAssetId": str(ASSET_ID),
        "assetId": "COG-LAP-0001",
        "categoryId": str(uuid.uuid4()),
        "hasPurchaseReceipt": False,
        "purchaseReceiptFileName": None,
        "warrantyExpiry": None,
        "status": "In Stock",
    }
    mock = AsyncMock(return_value=created)
    monkeypatch.setattr(assets_service, "create_asset", mock)

    response = await hr_client.post(
        "/api/v1/assets",
        json={"categoryId": str(uuid.uuid4()), "serialNumber": "SN-1"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["hasPurchaseReceipt"] is False
    assert body["purchaseReceiptFileName"] is None


@pytest.mark.asyncio
async def test_upload_replace_and_download_purchase_receipt(
    hr_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
    storage: MagicMock,
) -> None:
    monkeypatch.setattr(
        "app.modules.assets.files.read_validated_purchase_receipt",
        AsyncMock(return_value=(b"%PDF-1.4", "application/pdf")),
    )
    upload_mock = AsyncMock(
        return_value=(
            {
                "systemAssetId": str(ASSET_ID),
                "hasPurchaseReceipt": True,
                "purchaseReceiptFileName": "till.pdf",
            },
            None,
        )
    )
    monkeypatch.setattr(assets_service, "set_purchase_receipt", upload_mock)

    upload = await hr_client.post(
        f"/api/v1/assets/{ASSET_ID}/purchase-receipt",
        files=[("file", ("till.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf"))],
    )
    assert upload.status_code == 200
    assert upload.json()["hasPurchaseReceipt"] is True
    assert upload.json()["purchaseReceiptFileName"] == "till.pdf"
    storage.put_bytes.assert_called_once()
    object_key = storage.put_bytes.call_args.args[0]
    assert str(ASSET_ID) in object_key
    assert "purchase-receipt" in object_key

    replace_mock = AsyncMock(
        return_value=(
            {
                "systemAssetId": str(ASSET_ID),
                "hasPurchaseReceipt": True,
                "purchaseReceiptFileName": "invoice.png",
            },
            object_key,
        )
    )
    monkeypatch.setattr(assets_service, "set_purchase_receipt", replace_mock)
    monkeypatch.setattr(
        "app.modules.assets.files.read_validated_purchase_receipt",
        AsyncMock(return_value=(b"\x89PNG", "image/png")),
    )
    replaced = await hr_client.post(
        f"/api/v1/assets/{ASSET_ID}/purchase-receipt",
        files=[("file", ("invoice.png", io.BytesIO(b"\x89PNG"), "image/png"))],
    )
    assert replaced.status_code == 200
    assert replaced.json()["purchaseReceiptFileName"] == "invoice.png"
    storage.remove.assert_called_once_with(object_key)

    monkeypatch.setattr(
        assets_service,
        "purchase_receipt_object",
        AsyncMock(return_value=("assets/x/purchase-receipt/invoice.png", "invoice.png")),
    )
    downloaded = await hr_client.get(f"/api/v1/assets/{ASSET_ID}/purchase-receipt")
    assert downloaded.status_code == 200
    assert downloaded.content == b"%PDF-bytes"
    assert "invoice.png" in downloaded.headers.get("content-disposition", "")


@pytest.mark.asyncio
async def test_delete_purchase_receipt(
    hr_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
    storage: MagicMock,
) -> None:
    monkeypatch.setattr(
        assets_service,
        "clear_purchase_receipt",
        AsyncMock(
            return_value=(
                {
                    "systemAssetId": str(ASSET_ID),
                    "hasPurchaseReceipt": False,
                    "purchaseReceiptFileName": None,
                },
                "assets/old/receipt.pdf",
            )
        ),
    )
    response = await hr_client.delete(f"/api/v1/assets/{ASSET_ID}/purchase-receipt")
    assert response.status_code == 200
    assert response.json()["hasPurchaseReceipt"] is False
    storage.remove.assert_called_once_with("assets/old/receipt.pdf")
