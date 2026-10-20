"""National-ID identity: nationality → document type → optional number.

Country for catalog validation comes from Personal nationality.
Work mode and office location are not used. ``national_id_country`` is
left unused (nullable column; not written).
"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.field_crypto import encrypt_field, identifier_last4
from app.modules.employee.national_id_validation import (
    normalize_national_id_number,
    validate_national_id_number,
)
from app.modules.national_id.service import assert_active_national_id_document_type

NATIONAL_ID_VERIFICATION_PENDING = "PENDING"
NATIONAL_ID_VERIFICATION_VERIFIED = "VERIFIED"
NATIONAL_ID_VERIFICATION_REJECTED = "REJECTED"
NATIONAL_ID_VERIFICATION_STATUSES = frozenset(
    {
        NATIONAL_ID_VERIFICATION_PENDING,
        NATIONAL_ID_VERIFICATION_VERIFIED,
        NATIONAL_ID_VERIFICATION_REJECTED,
    }
)


def _optional_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def resolve_nationality_for_document_types(
    body: dict[str, Any],
    emp: Any,
) -> str | None:
    """ISO nationality (or OTHER) from the write body, else the stored employee."""
    raw = body.get("nationality") if "nationality" in body else getattr(emp, "nationality", None)
    text = _optional_str(raw)
    return text.upper() if text else None


async def apply_national_id_identity(
    session: AsyncSession,
    emp: Any,
    body: dict[str, Any],
) -> None:
    """Validate catalog type against nationality, encrypt number, set verification.

    Call when any national-ID key is present on create/update.
    """
    keys = (
        "nationalIdNumber",
        "nationalIdDocumentType",
        "nationalIdDocumentTypeId",
        "nationalIdDocumentTypeCode",
    )
    if not any(k in body for k in keys):
        return

    country = resolve_nationality_for_document_types(body, emp)

    type_id_raw = body.get("nationalIdDocumentTypeId")
    type_code = _optional_str(
        body.get("nationalIdDocumentType")
        or body.get("nationalIdDocumentTypeCode")
    )
    type_id: uuid.UUID | None = None
    if type_id_raw not in (None, ""):
        try:
            type_id = uuid.UUID(str(type_id_raw))
        except ValueError as exc:
            raise HTTPException(
                status_code=400, detail="Invalid nationalIdDocumentTypeId"
            ) from exc

    catalog_row = None
    setting_type = type_id is not None or bool(type_code)
    if not setting_type and not getattr(emp, "national_id_document_type", None):
        if "nationalIdNumber" in body and _optional_str(body.get("nationalIdNumber")):
            raise HTTPException(
                status_code=400,
                detail="nationalIdDocumentType is required when setting nationalIdNumber",
            )
        return

    if setting_type:
        if not country:
            raise HTTPException(
                status_code=400,
                detail="nationality is required when setting national ID fields",
            )
        catalog_row = await assert_active_national_id_document_type(
            session,
            document_type_id=type_id,
            document_type_code=type_code,
            country_code=country,
        )
        old_code = getattr(emp, "national_id_document_type", None)
        new_code = catalog_row.document_type_code
        emp.national_id_document_type = new_code
        if (
            old_code
            and new_code
            and str(old_code).upper() != str(new_code).upper()
            and "nationalIdNumber" not in body
        ):
            emp.national_id_number_encrypted = None
            emp.national_id_last4 = None
            emp.national_id_verification_status = None

    if "nationalIdNumber" not in body:
        return

    number = _optional_str(body.get("nationalIdNumber"))
    if number is None:
        emp.national_id_number_encrypted = None
        emp.national_id_last4 = None
        emp.national_id_verification_status = None
        return

    doc_code = (
        catalog_row.document_type_code
        if catalog_row is not None
        else getattr(emp, "national_id_document_type", None)
    )
    if not doc_code:
        raise HTTPException(
            status_code=400,
            detail="nationalIdDocumentType is required when setting nationalIdNumber",
        )
    if catalog_row is None:
        catalog_row = await assert_active_national_id_document_type(
            session,
            document_type_code=str(doc_code),
            country_code=country,
        )
    fmt = catalog_row.number_format if catalog_row is not None else None
    validate_national_id_number(
        number,
        catalog_format=fmt,
        document_type_code=str(doc_code),
        country_code=country,
    )
    normalized = normalize_national_id_number(
        number,
        str(doc_code),
    )
    emp.national_id_number_encrypted = encrypt_field(normalized)
    emp.national_id_last4 = identifier_last4(normalized)
    emp.national_id_verification_status = NATIONAL_ID_VERIFICATION_PENDING
