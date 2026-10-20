"""Asset Management HTTP routes."""

from __future__ import annotations

import uuid
from typing import Any
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import Response

from app.core.role_groups import HR_STAFF_ROLES
from app.core.storage import get_storage, read_object, safe_filename
from app.dependencies import CurrentUser
from app.modules.assets import service as svc
from app.modules.deps import DbSession
from app.modules.rbac.access import MODULE_KEY_ASSETS, require_module_access
from app.modules.rbac.grants import ACCESS_LEVEL_FULL_ACCESS, ACCESS_LEVEL_READ_ONLY

router = APIRouter(prefix="/assets", tags=["Assets"])

_assets_read = require_module_access(
    MODULE_KEY_ASSETS,
    min_level=ACCESS_LEVEL_READ_ONLY,
)
_assets_write = require_module_access(
    MODULE_KEY_ASSETS,
    min_level=ACCESS_LEVEL_FULL_ACCESS,
)


def _parse_employee_uuid(raw: str) -> uuid.UUID:
    return uuid.UUID(str(raw))


def _role_values() -> set[str]:
    return {getattr(r, "value", str(r)) for r in HR_STAFF_ROLES}


@router.get("/categories", dependencies=[Depends(_assets_read)])
async def list_categories(db: DbSession) -> list[dict]:
    return await svc.list_categories(db)


@router.get("", dependencies=[Depends(_assets_read)])
async def list_assets(
    db: DbSession,
    categoryId: str | None = Query(None, alias="categoryId"),
    status: str | None = None,
    condition: str | None = None,
    q: str | None = None,
    employeeName: str | None = Query(None, alias="employeeName"),
    osPlatform: str | None = Query(None, alias="osPlatform"),
    purchaseDateFrom: str | None = Query(None, alias="purchaseDateFrom"),
    purchaseDateTo: str | None = Query(None, alias="purchaseDateTo"),
    warrantyExpiryFrom: str | None = Query(None, alias="warrantyExpiryFrom"),
    warrantyExpiryTo: str | None = Query(None, alias="warrantyExpiryTo"),
    warrantyExpiringSoon: bool = Query(False, alias="warrantyExpiringSoon"),
    warrantyExpired: bool = Query(False, alias="warrantyExpired"),
) -> list[dict]:
    return await svc.list_assets(
        db,
        category_id=categoryId,
        status_filter=status,
        condition=condition,
        q=q,
        employee_name=employeeName,
        os_platform=osPlatform,
        purchase_date_from=purchaseDateFrom,
        purchase_date_to=purchaseDateTo,
        warranty_expiry_from=warrantyExpiryFrom,
        warranty_expiry_to=warrantyExpiryTo,
        warranty_expiring_soon=warrantyExpiringSoon,
        warranty_expired=warrantyExpired,
    )


@router.post("", dependencies=[Depends(_assets_write)])
async def create_asset(db: DbSession, user: CurrentUser, body: dict[str, Any]) -> dict:
    return await svc.create_asset(db, user, body)


@router.get("/mine")
async def my_assets(db: DbSession, user: CurrentUser) -> list[dict]:
    employee_id = user.get("id") or user.get("employeeId")
    if not employee_id:
        return []
    return await svc.list_employee_assets(db, _parse_employee_uuid(str(employee_id)))


@router.get("/employees/{employee_id}")
async def employee_assets(
    db: DbSession,
    user: CurrentUser,
    employee_id: uuid.UUID,
    includeHistory: bool = Query(False, alias="includeHistory"),
) -> list[dict]:
    role = str(user.get("role") or "")
    self_id = str(user.get("id") or user.get("employeeId") or "")
    if role not in _role_values() and self_id != str(employee_id):
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to view another employee's assets",
        )
    return await svc.list_employee_assets(
        db, employee_id, include_history=includeHistory
    )


@router.post(
    "/{system_asset_id}/allocate",
    dependencies=[Depends(_assets_write)],
)
async def allocate_asset(
    db: DbSession, user: CurrentUser, system_asset_id: uuid.UUID, body: dict[str, Any]
) -> dict:
    return await svc.allocate_asset(db, user, system_asset_id, body)


@router.post(
    "/allocations/{allocation_id}/return",
    dependencies=[Depends(_assets_write)],
)
async def return_allocation(
    db: DbSession, user: CurrentUser, allocation_id: uuid.UUID, body: dict[str, Any]
) -> dict:
    return await svc.return_allocation(db, user, allocation_id, body)


@router.post(
    "/allocations/{allocation_id}/swap",
    dependencies=[Depends(_assets_write)],
)
async def swap_asset(
    db: DbSession, user: CurrentUser, allocation_id: uuid.UUID, body: dict[str, Any]
) -> dict:
    return await svc.swap_asset(db, user, allocation_id, body)


@router.get(
    "/{system_asset_id}/activity",
    dependencies=[Depends(_assets_read)],
)
async def asset_activity(db: DbSession, system_asset_id: uuid.UUID) -> list[dict]:
    return await svc.list_asset_activity(db, system_asset_id)


@router.post(
    "/{system_asset_id}/purchase-receipt",
    dependencies=[Depends(_assets_write)],
)
async def upload_purchase_receipt(
    db: DbSession,
    user: CurrentUser,
    system_asset_id: uuid.UUID,
    file: UploadFile = File(...),
) -> dict:
    """Attach or replace the optional purchase-receipt file (MinIO/local)."""
    from app.modules.assets.files import read_validated_purchase_receipt

    data, content_type = await read_validated_purchase_receipt(file)
    filename = safe_filename(file.filename or "purchase-receipt")
    object_key = f"assets/{system_asset_id}/purchase-receipt/{uuid.uuid4()}/{filename}"
    storage = get_storage()
    storage.put_bytes(object_key, data, content_type)
    try:
        payload, previous = await svc.set_purchase_receipt(
            db, user, system_asset_id, object_key, filename
        )
    except Exception:
        try:
            storage.remove(object_key)
        except Exception:
            pass
        raise
    if previous:
        try:
            storage.remove(previous)
        except Exception:
            pass
    return payload


@router.get(
    "/{system_asset_id}/purchase-receipt",
    dependencies=[Depends(_assets_read)],
)
async def download_purchase_receipt(
    db: DbSession, system_asset_id: uuid.UUID
) -> Response:
    """Download the purchase receipt stored on this asset."""
    object_key, filename = await svc.purchase_receipt_object(db, system_asset_id)
    data, content_type = await read_object(get_storage(), object_key)
    return Response(
        content=data,
        media_type=content_type or "application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"
        },
    )


@router.delete(
    "/{system_asset_id}/purchase-receipt",
    dependencies=[Depends(_assets_write)],
)
async def delete_purchase_receipt(
    db: DbSession, user: CurrentUser, system_asset_id: uuid.UUID
) -> dict:
    """Remove the purchase-receipt file from this asset."""
    payload, previous = await svc.clear_purchase_receipt(db, user, system_asset_id)
    if previous:
        try:
            get_storage().remove(previous)
        except Exception:
            pass
    return payload


@router.patch(
    "/{system_asset_id}",
    dependencies=[Depends(_assets_write)],
)
async def update_asset(
    db: DbSession,
    user: CurrentUser,
    system_asset_id: uuid.UUID,
    body: dict[str, Any],
) -> dict:
    return await svc.update_asset(db, user, system_asset_id, body)


@router.post(
    "/{system_asset_id}/retire",
    dependencies=[Depends(_assets_write)],
)
async def retire_asset(
    db: DbSession, user: CurrentUser, system_asset_id: uuid.UUID
) -> dict:
    return await svc.retire_asset(db, user, system_asset_id)


@router.post(
    "/{system_asset_id}/return-to-stock",
    dependencies=[Depends(_assets_write)],
)
async def return_asset_to_stock(
    db: DbSession, user: CurrentUser, system_asset_id: uuid.UUID
) -> dict:
    return await svc.return_asset_to_stock(db, user, system_asset_id)


@router.post(
    "/{system_asset_id}/report-lost",
    dependencies=[Depends(_assets_write)],
)
async def report_asset_lost(
    db: DbSession, user: CurrentUser, system_asset_id: uuid.UUID, body: dict[str, Any]
) -> dict:
    return await svc.report_lost(db, user, system_asset_id, body)


@router.post(
    "/{system_asset_id}/mark-found",
    dependencies=[Depends(_assets_write)],
)
async def mark_asset_found(
    db: DbSession, user: CurrentUser, system_asset_id: uuid.UUID, body: dict[str, Any]
) -> dict:
    return await svc.mark_found(db, user, system_asset_id, body)
