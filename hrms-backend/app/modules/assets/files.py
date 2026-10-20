"""Upload validation for asset purchase receipts."""

from __future__ import annotations

from fastapi import UploadFile

from app.modules.employee.files import DOCUMENT_MAX_BYTES, read_validated_upload

# Same 10 MB cap as employee resume / certificate documents.
PURCHASE_RECEIPT_MAX_BYTES = DOCUMENT_MAX_BYTES

PURCHASE_RECEIPT_CONTENT_TYPES = frozenset(
    {
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
    }
)


async def read_validated_purchase_receipt(
    upload: UploadFile | None,
) -> tuple[bytes, str]:
    return await read_validated_upload(
        upload,
        allowed_types=PURCHASE_RECEIPT_CONTENT_TYPES,
        max_bytes=PURCHASE_RECEIPT_MAX_BYTES,
        kind="Purchase receipt",
    )
