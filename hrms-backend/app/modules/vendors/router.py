import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.core.role_groups import HR_STAFF_ROLES
from app.dependencies import CurrentUser, require_roles
from app.modules.deps import DbSession
from app.modules.vendors import service as svc

router = APIRouter(prefix="/vendors", tags=["Vendors"])


@router.get("", dependencies=[Depends(require_roles(*HR_STAFF_ROLES))])
async def list_vendors(db: DbSession) -> list[dict]:
    return await svc.list_vendors(db)


@router.get("/inactive", dependencies=[Depends(require_roles(*HR_STAFF_ROLES))])
async def inactive_vendors(db: DbSession) -> list[dict]:
    return await svc.inactive_vendors(db)


@router.get("/search", dependencies=[Depends(require_roles(*HR_STAFF_ROLES))])
async def search_vendors(db: DbSession, q: str = Query(...)) -> list[dict]:
    return await svc.search_vendors(db, q)


@router.get("/invoices/summary", dependencies=[Depends(require_roles(*HR_STAFF_ROLES))])
async def vendor_invoice_summary(db: DbSession) -> list[dict]:
    return await svc.vendor_invoice_summary(db)


@router.get("/invoices", dependencies=[Depends(require_roles(*HR_STAFF_ROLES))])
async def all_vendor_invoices(db: DbSession) -> list[dict]:
    return await svc.list_vendor_invoices(db)


@router.get("/invoices/by-employee", dependencies=[Depends(require_roles(*HR_STAFF_ROLES))])
async def vendor_invoices_by_employee(db: DbSession, employee_id: str = Query(...)) -> list[dict]:
    return await svc.vendor_invoices_by_employee(db, employee_id)


@router.get("/{vendor_id}", dependencies=[Depends(require_roles(*HR_STAFF_ROLES))])
async def get_vendor(db: DbSession, vendor_id: uuid.UUID) -> dict:
    return await svc.get_vendor(db, vendor_id)


@router.post("", dependencies=[Depends(require_roles(*HR_STAFF_ROLES))])
async def create_vendor(db: DbSession, user: CurrentUser, body: dict[str, Any]) -> dict:
    return await svc.create_vendor(db, user, body)


@router.patch("/{vendor_id}", dependencies=[Depends(require_roles(*HR_STAFF_ROLES))])
async def update_vendor(db: DbSession, vendor_id: uuid.UUID, body: dict[str, Any]) -> dict:
    return await svc.update_vendor(db, vendor_id, body)


@router.delete("/{vendor_id}", dependencies=[Depends(require_roles(*HR_STAFF_ROLES))])
async def delete_vendor(db: DbSession, vendor_id: uuid.UUID) -> dict:
    return await svc.delete_vendor(db, vendor_id)


@router.get("/{vendor_id}/invoices", dependencies=[Depends(require_roles(*HR_STAFF_ROLES))])
async def vendor_invoices(db: DbSession, vendor_id: uuid.UUID) -> list[dict]:
    return await svc.list_vendor_invoices(db, vendor_id)


@router.post("/{vendor_id}/invoices", dependencies=[Depends(require_roles(*HR_STAFF_ROLES))])
async def create_vendor_invoice(db: DbSession, vendor_id: uuid.UUID, body: dict[str, Any]) -> dict:
    body = {**body, "vendorId": str(vendor_id)}
    return await svc.create_vendor_invoice(db, body)


@router.patch("/invoices/{invoice_id}", dependencies=[Depends(require_roles(*HR_STAFF_ROLES))])
async def update_vendor_invoice(db: DbSession, invoice_id: uuid.UUID, body: dict[str, Any]) -> dict:
    return await svc.update_vendor_invoice(db, invoice_id, body)


@router.get("/{vendor_id}/invoices/summary", dependencies=[Depends(require_roles(*HR_STAFF_ROLES))])
async def summary_by_vendor(db: DbSession, vendor_id: uuid.UUID) -> dict:
    return await svc.vendor_invoice_summary_by_vendor(db, str(vendor_id))
