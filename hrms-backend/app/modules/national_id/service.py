from __future__ import annotations

import re
import uuid

from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tables import NationalIdDocumentType
from app.modules.org.service import (
    MASTER_STATUS_ACTIVE,
    MASTER_STATUS_INACTIVE,
    _parse_status,
    viewer_sees_inactive,
)

CODE_TAKEN = "A document type with this code already exists."
TYPE_NOT_ACTIVE = "That document type is not active. Choose another from the list."
TYPE_WRONG_COUNTRY = "That document type is not used in this country. Choose another from the list."
_CODE_RE = re.compile(r"^[A-Z0-9_]{2,40}$")
_COUNTRY_RE = re.compile(r"^[A-Z]{2}$")


def _actor_name(actor: dict) -> str | None:
    return f"{actor.get('firstName', '')} {actor.get('lastName', '')}".strip() or None


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_code(raw: Any) -> str:
    code = str(raw or "").strip().upper().replace(" ", "_").replace("-", "_")
    if not _CODE_RE.match(code):
        raise HTTPException(
            status_code=400,
            detail="Code must be 2–40 letters, numbers, or underscores (example: SSN, DRIVERS_LICENSE).",
        )
    return code


def _parse_country(raw: Any) -> str | None:
    if raw in (None, ""):
        return None
    country = str(raw).strip().upper()
    if not _COUNTRY_RE.match(country):
        raise HTTPException(
            status_code=400,
            detail="Country must be a 2-letter code (US, IN) or empty for every country.",
        )
    return country


def type_to_dict(row: NationalIdDocumentType) -> dict[str, Any]:
    return {
        "documentTypeId": str(row.national_id_document_type_id),
        "documentTypeCode": row.document_type_code,
        "documentTypeLabel": row.document_type_label,
        "countryCode": row.country_code,
        "format": row.number_format,
        "status": row.status or MASTER_STATUS_ACTIVE,
        "createdBy": row.created_by,
        "updatedBy": row.updated_by,
        "createdDate": row.created_date.isoformat() if row.created_date else None,
        "updatedDate": row.updated_date.isoformat() if row.updated_date else None,
    }


async def _flush_unique(db: AsyncSession) -> None:
    try:
        await db.flush()
    except IntegrityError as exc:
        message = str(getattr(exc, "orig", exc))
        if "ux_national_id_doc_type_code_lower" in message:
            raise HTTPException(status_code=409, detail=CODE_TAKEN) from exc
        raise


async def _assert_unique_code(
    db: AsyncSession, code: str, *, exclude_id: uuid.UUID | None = None
) -> None:
    stmt = select(NationalIdDocumentType.national_id_document_type_id).where(
        func.lower(NationalIdDocumentType.document_type_code) == code.lower()
    )
    if exclude_id is not None:
        stmt = stmt.where(NationalIdDocumentType.national_id_document_type_id != exclude_id)
    result = await db.execute(stmt.limit(1))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail=CODE_TAKEN)


def _country_filter(stmt: Any, country: str):
    wanted = country.strip().upper()
    return stmt.where(
        or_(
            NationalIdDocumentType.country_code.is_(None),
            func.upper(NationalIdDocumentType.country_code) == wanted,
        )
    )


async def list_document_types(
    db: AsyncSession,
    *,
    include_inactive: bool = False,
    country: str | None = None,
) -> list[dict]:
    """HR pickers: Active only. Optional country = that country plus global (Passport)."""
    stmt = select(NationalIdDocumentType).order_by(
        NationalIdDocumentType.country_code.nullsfirst(),
        NationalIdDocumentType.document_type_label,
    )
    if not include_inactive:
        stmt = stmt.where(NationalIdDocumentType.status == MASTER_STATUS_ACTIVE)
    if country:
        stmt = _country_filter(stmt, country)
    result = await db.execute(stmt)
    return [type_to_dict(row) for row in result.scalars().all()]


async def get_document_type(
    db: AsyncSession,
    type_id: uuid.UUID,
    *,
    include_inactive: bool = False,
) -> dict:
    result = await db.execute(
        select(NationalIdDocumentType).where(
            NationalIdDocumentType.national_id_document_type_id == type_id
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Document type not found")
    if not include_inactive and (row.status or MASTER_STATUS_ACTIVE) != MASTER_STATUS_ACTIVE:
        raise HTTPException(status_code=404, detail="Document type not found")
    return type_to_dict(row)


async def create_document_type(db: AsyncSession, actor: dict, body: dict[str, Any]) -> dict:
    """Admin adds an official type. Empty country = every country (Passport)."""
    code = _parse_code(body.get("documentTypeCode"))
    label = str(body.get("documentTypeLabel") or "").strip()
    if not label:
        raise HTTPException(status_code=400, detail="Label is required.")
    country = _parse_country(body.get("countryCode"))
    fmt = str(body.get("format") or "").strip() or None
    await _assert_unique_code(db, code)
    now = _now()
    actor_name = _actor_name(actor)
    row = NationalIdDocumentType(
        document_type_code=code,
        document_type_label=label,
        country_code=country,
        number_format=fmt,
        status=MASTER_STATUS_ACTIVE,
        created_by=actor_name,
        updated_by=actor_name,
        created_date=now,
        updated_date=now,
    )
    db.add(row)
    await _flush_unique(db)
    return type_to_dict(row)


async def update_document_type(
    db: AsyncSession, actor: dict, type_id: uuid.UUID, body: dict[str, Any]
) -> dict:
    result = await db.execute(
        select(NationalIdDocumentType).where(
            NationalIdDocumentType.national_id_document_type_id == type_id
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Document type not found")
    if "documentTypeCode" in body and body["documentTypeCode"] is not None:
        code = _parse_code(body.get("documentTypeCode"))
        await _assert_unique_code(db, code, exclude_id=type_id)
        row.document_type_code = code
    if "documentTypeLabel" in body and body["documentTypeLabel"] is not None:
        label = str(body["documentTypeLabel"]).strip()
        if not label:
            raise HTTPException(status_code=400, detail="Label cannot be empty.")
        row.document_type_label = label
    if "countryCode" in body:
        row.country_code = _parse_country(body.get("countryCode"))
    if "format" in body:
        raw = body.get("format")
        row.number_format = (str(raw).strip() or None) if raw is not None else None
    if "status" in body:
        row.status = _parse_status(body.get("status"))
    row.updated_by = _actor_name(actor)
    row.updated_date = _now()
    await _flush_unique(db)
    return type_to_dict(row)


async def delete_document_type(db: AsyncSession, type_id: uuid.UUID) -> dict:
    result = await db.execute(
        select(NationalIdDocumentType).where(
            NationalIdDocumentType.national_id_document_type_id == type_id
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Document type not found")
    await db.delete(row)
    await db.flush()
    return {"documentTypeId": str(type_id), "deleted": True}


async def assert_active_national_id_document_type(
    db: AsyncSession,
    *,
    document_type_id: uuid.UUID | None = None,
    document_type_code: str | None = None,
    country_code: str | None = None,
) -> NationalIdDocumentType:
    """Dev 3: reject missing, Inactive, or wrong-country types on employee save."""
    if document_type_id is not None:
        stmt = select(NationalIdDocumentType).where(
            NationalIdDocumentType.national_id_document_type_id == document_type_id
        )
    elif document_type_code:
        stmt = select(NationalIdDocumentType).where(
            func.lower(NationalIdDocumentType.document_type_code)
            == document_type_code.strip().lower()
        )
    else:
        raise HTTPException(status_code=400, detail="Document type is required.")
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=400, detail="That document type was not found.")
    if (row.status or MASTER_STATUS_ACTIVE) != MASTER_STATUS_ACTIVE:
        raise HTTPException(status_code=400, detail=TYPE_NOT_ACTIVE)
    if country_code:
        wanted = country_code.strip().upper()
        if row.country_code and row.country_code.upper() != wanted:
            raise HTTPException(status_code=400, detail=TYPE_WRONG_COUNTRY)
    return row


async def seed_default_document_types(db: AsyncSession) -> int:
    """Insert the starter pack if those codes are missing. Safe to run many times."""
    seeds: list[dict[str, str | None]] = [
        {
            "code": "PASSPORT",
            "label": "Passport",
            "country": None,
            "format": None,
        },
        {
            "code": "SSN",
            "label": "Social Security Number",
            "country": "US",
            "format": r"^\d{9}$",
        },
        {
            "code": "DRIVERS_LICENSE",
            "label": "Driver's license",
            "country": "US",
            "format": r"^[A-Z0-9]{5,20}$",
        },
        {
            "code": "AADHAAR",
            "label": "Aadhaar",
            "country": "IN",
            "format": r"^\d{12}$",
        },
        {
            "code": "PAN",
            "label": "PAN",
            "country": "IN",
            "format": r"^[A-Z]{5}\d{4}[A-Z]$",
        },
    ]
    added = 0
    now = _now()
    for item in seeds:
        exists = await db.execute(
            select(NationalIdDocumentType.national_id_document_type_id).where(
                func.lower(NationalIdDocumentType.document_type_code) == item["code"].lower()
            )
        )
        if exists.scalar_one_or_none() is not None:
            continue
        db.add(
            NationalIdDocumentType(
                document_type_code=item["code"],
                document_type_label=item["label"],
                country_code=item["country"],
                number_format=item["format"],
                status=MASTER_STATUS_ACTIVE,
                created_by="seed",
                updated_by="seed",
                created_date=now,
                updated_date=now,
            )
        )
        added += 1
    if added:
        await db.flush()
    return added


# Re-export for routers.
__all__ = [
    "CODE_TAKEN",
    "TYPE_NOT_ACTIVE",
    "TYPE_WRONG_COUNTRY",
    "assert_active_national_id_document_type",
    "create_document_type",
    "delete_document_type",
    "get_document_type",
    "list_document_types",
    "seed_default_document_types",
    "type_to_dict",
    "update_document_type",
    "viewer_sees_inactive",
]
