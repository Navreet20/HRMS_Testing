from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.employee_ids import parse_employee_uuid, require_existing_employee
from app.core.roles import Status
from app.models.awaiting import (VendorInvoice)
from app.models.awaiting import (Vendor)
from app.core.serialize import vendor_to_dict


def _vendor_invoice_to_dict(inv: VendorInvoice) -> dict:
    return {
        "vendorInvoiceId": str(inv.vendor_invoice_id),
        "vendorName": inv.vendor_name,
        "employeeId": str(inv.employee_id) if inv.employee_id is not None else None,
        "billNumber": inv.bill_number,
        "invoiceMonthandYear": inv.invoice_month_year,
        "poNumber": inv.po_number,
        "billDate": inv.bill_date,
        "netTerm": inv.net_term,
        "dueDate": inv.due_date,
        "invoiceRate": inv.invoice_rate,
        "invoiceHours": inv.invoice_hours,
        "invoicedAmount": float(inv.invoiced_amount) if inv.invoiced_amount is not None else None,
        "paidAmount": float(inv.paid_amount) if inv.paid_amount is not None else None,
        "balanceAmount": float(inv.balance_amount) if inv.balance_amount is not None else None,
        "invoiceStatus": inv.invoice_status,
    }


async def _vendor_name_for_id(db: AsyncSession, vendor_id: uuid.UUID | str) -> str | None:
    try:
        vid = uuid.UUID(str(vendor_id))
    except ValueError:
        return None
    result = await db.execute(select(Vendor).where(Vendor.vendor_id == vid))
    vendor = result.scalar_one_or_none()
    return vendor.vendor_name if vendor else None


async def list_vendors(db: AsyncSession) -> list[dict]:
    result = await db.execute(select(Vendor))
    return [vendor_to_dict(v) for v in result.scalars().all()]


async def get_vendor(db: AsyncSession, vendor_id: uuid.UUID) -> dict:
    result = await db.execute(select(Vendor).where(Vendor.vendor_id == vendor_id))
    vendor = result.scalar_one_or_none()
    if vendor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
    return vendor_to_dict(vendor)


async def create_vendor(db: AsyncSession, actor: dict, payload: dict[str, Any]) -> dict:
    actor_name = f"{actor.get('firstName', '')} {actor.get('lastName', '')}".strip()
    vendor = Vendor(
        vendor_name=payload.get("vendorName") or payload.get("name") or "Vendor",
        vendor_status=payload.get("vendorStatus") or payload.get("status") or Status.ACTIVE,
        vendor_company_type=payload.get("vendorType") or payload.get("type"),
        vendor_company_contact_name=payload.get("contactName") or actor_name or "Contact",
        vendor_company_designation=payload.get("designation"),
        vendor_ein_number=payload.get("ein") or payload.get("vendorEinNumber") or "000000000",
        vendor_net_term=str(payload.get("vendorNetTerm") or payload.get("netPayTerm") or "30"),
        msa_start_date=payload.get("msaStartDate"),
        msa_end_date=payload.get("msaEndDate"),
        created_by=actor_name,
        updated_by=actor_name,
        created_date=datetime.utcnow(),
        updated_date=datetime.utcnow(),
    )
    db.add(vendor)
    await db.flush()
    return vendor_to_dict(vendor)


async def update_vendor(db: AsyncSession, vendor_id: uuid.UUID, payload: dict[str, Any]) -> dict:
    result = await db.execute(select(Vendor).where(Vendor.vendor_id == vendor_id))
    vendor = result.scalar_one_or_none()
    if vendor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
    if payload.get("vendorName") is not None or payload.get("name") is not None:
        vendor.vendor_name = payload.get("vendorName") or payload.get("name")
    if payload.get("vendorStatus") is not None or payload.get("status") is not None:
        vendor.vendor_status = payload.get("vendorStatus") or payload.get("status")
    if payload.get("vendorType") is not None or payload.get("type") is not None:
        vendor.vendor_company_type = payload.get("vendorType") or payload.get("type")
    if payload.get("contactName") is not None:
        vendor.vendor_company_contact_name = payload["contactName"]
    if payload.get("designation") is not None:
        vendor.vendor_company_designation = payload["designation"]
    if payload.get("ein") is not None:
        vendor.vendor_ein_number = payload["ein"]
    if payload.get("vendorNetTerm") is not None or payload.get("netPayTerm") is not None:
        vendor.vendor_net_term = str(payload.get("vendorNetTerm") or payload.get("netPayTerm"))
    vendor.updated_date = datetime.utcnow()
    await db.flush()
    return vendor_to_dict(vendor)


async def delete_vendor(db: AsyncSession, vendor_id: uuid.UUID) -> dict:
    result = await db.execute(select(Vendor).where(Vendor.vendor_id == vendor_id))
    vendor = result.scalar_one_or_none()
    if vendor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
    vendor.vendor_status = Status.INACTIVE
    vendor.updated_date = datetime.utcnow()
    await db.flush()
    return vendor_to_dict(vendor)


async def search_vendors(db: AsyncSession, query: str) -> list[dict]:
    pattern = f"%{query}%"
    result = await db.execute(select(Vendor).where(Vendor.vendor_name.ilike(pattern)))
    return [vendor_to_dict(v) for v in result.scalars().all()]


async def inactive_vendors(db: AsyncSession) -> list[dict]:
    result = await db.execute(select(Vendor).where(Vendor.vendor_status == Status.INACTIVE))
    return [vendor_to_dict(v) for v in result.scalars().all()]


async def list_vendor_invoices(db: AsyncSession, vendor_id: uuid.UUID | None = None) -> list[dict]:
    q = select(VendorInvoice)
    if vendor_id:
        name = await _vendor_name_for_id(db, vendor_id)
        if name is None:
            return []
        q = q.where(VendorInvoice.vendor_name == name)
    result = await db.execute(q)
    return [_vendor_invoice_to_dict(i) for i in result.scalars().all()]


async def create_vendor_invoice(db: AsyncSession, payload: dict[str, Any]) -> dict:
    vendor_name = payload.get("vendorName")
    if not vendor_name and payload.get("vendorId"):
        vendor_name = await _vendor_name_for_id(db, payload["vendorId"])
    inv = VendorInvoice(
        vendor_name=vendor_name or "Unknown",
        employee_id=await require_existing_employee(db, payload.get("employeeId")),
        bill_number=payload.get("billNumber") or payload.get("invoiceNumber") or "",
        invoice_month_year=payload.get("invoiceMonthandYear"),
        po_number=payload.get("poNumber"),
        bill_date=payload.get("billDate"),
        net_term=str(payload.get("netTerm") or "30"),
        due_date=payload.get("dueDate") or "",
        invoice_rate=payload.get("invoiceRate", "0"),
        invoice_hours=payload.get("invoiceHours", "0"),
        invoiced_amount=payload.get("invoicedAmount", 0),
        invoice_status=payload.get("invoiceStatus") or Status.PENDING,
        created_date=datetime.utcnow(),
        updated_date=datetime.utcnow(),
    )
    db.add(inv)
    await db.flush()
    return _vendor_invoice_to_dict(inv)


async def update_vendor_invoice(db: AsyncSession, invoice_id: uuid.UUID, payload: dict[str, Any]) -> dict:
    result = await db.execute(select(VendorInvoice).where(VendorInvoice.vendor_invoice_id == invoice_id))
    inv = result.scalar_one_or_none()
    if inv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    if payload.get("invoiceStatus") is not None:
        inv.invoice_status = payload["invoiceStatus"]
    if payload.get("invoicedAmount") is not None:
        inv.invoiced_amount = payload["invoicedAmount"]
    inv.updated_date = datetime.utcnow()
    await db.flush()
    return _vendor_invoice_to_dict(inv)


async def vendor_invoices_by_employee(db: AsyncSession, employee_id: str) -> list[dict]:
    eid = parse_employee_uuid(employee_id)
    if eid is None:
        return []
    result = await db.execute(select(VendorInvoice).where(VendorInvoice.employee_id == eid))
    return [_vendor_invoice_to_dict(i) for i in result.scalars().all()]


async def vendor_invoice_summary(db: AsyncSession) -> list[dict]:
    result = await db.execute(select(VendorInvoice))
    invoices = result.scalars().all()
    total = sum(float(i.invoiced_amount or 0) for i in invoices)
    return [{"totalInvoicedAmount": total, "count": len(invoices)}]


async def vendor_invoice_summary_by_vendor(db: AsyncSession, vendor_id: str) -> dict:
    name = await _vendor_name_for_id(db, vendor_id)
    if name is None:
        return {"vendorId": vendor_id, "totalInvoicedAmount": 0, "count": 0}
    result = await db.execute(select(VendorInvoice).where(VendorInvoice.vendor_name == name))
    invoices = result.scalars().all()
    total = sum(float(i.invoiced_amount or 0) for i in invoices)
    return {"vendorId": vendor_id, "totalInvoicedAmount": total, "count": len(invoices)}
