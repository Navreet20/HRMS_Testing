"""HR onboarding packet documents against employee_onboarding_packet_documents.

New schema columns: document_type, version_number, file_key, uploaded_by_employee_id, uploaded_at.
DB document_type values: Offer Letter | ID Proof | I-9 | W-4 | NDA | Handbook Acknowledgement | Other.
"""

from __future__ import annotations

import logging
import uuid
from pathlib import Path
from typing import Any

from fastapi import HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.storage import get_storage, safe_filename
from app.mail.outbox import send_email
from app.mail.recipients import notification_recipients
from app.mail.templates import render
from app.mail.smtp import MailSendError
from app.models.tables import Employee, EmployeeOnboardingPacketDocument
from app.modules.employee.files import read_validated_upload

logger = logging.getLogger(__name__)

PACKET_STATUS_PENDING = "Pending"
PACKET_STATUS_UPLOADED = "Uploaded"

PACKET_UPLOAD_CONTENT_TYPES = frozenset(
    {
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
)
PACKET_UPLOAD_MAX_BYTES = 10 * 1024 * 1024

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
_TEMPLATE_ASSET = _BACKEND_ROOT / "assets" / "onboarding-templates" / "onboardingDoc.pdf"
_TEMPLATE_ASSET_FALLBACK = (
    Path(__file__).resolve().parents[2] / "assets" / "onboarding-templates" / "onboardingDoc.pdf"
)
_TEMPLATE_OBJECT_KEY = "onboarding-templates/shared/onboardingDoc.pdf"

# API code → (DB document_type, label, download name)
PACKET_SPECS: tuple[dict[str, str], ...] = (
    {"code": "NDA", "dbType": "NDA", "label": "Non-Disclosure Agreement (NDA)", "downloadName": "NDA.pdf"},
    {"code": "W4", "dbType": "W-4", "label": "W-4 Tax Form", "downloadName": "W-4-Tax-Form.pdf"},
    {
        "code": "BANK_ACCOUNT_DETAILS",
        "dbType": "Other",
        "label": "Bank Details",
        "downloadName": "Bank-Account-Details.pdf",
    },
    {
        "code": "EMPLOYEE_HANDBOOK",
        "dbType": "Handbook Acknowledgement",
        "label": "Employee Handbook",
        "downloadName": "Employee-Handbook.pdf",
    },
)

_PACKET_BY_CODE = {row["code"]: row for row in PACKET_SPECS}
_CODE_BY_DB = {row["dbType"]: row["code"] for row in PACKET_SPECS}


def normalize_packet_type(document_type: str) -> str:
    code = (document_type or "").strip().upper().replace("-", "_").replace(" ", "_")
    aliases = {
        "W_4": "W4",
        "BANK": "BANK_ACCOUNT_DETAILS",
        "BANK_DETAILS": "BANK_ACCOUNT_DETAILS",
        "BANK_ACCOUNT": "BANK_ACCOUNT_DETAILS",
        "HANDBOOK": "EMPLOYEE_HANDBOOK",
        "EMPLOYEE_HAND_BOOK": "EMPLOYEE_HANDBOOK",
        "HANDBOOK_ACKNOWLEDGEMENT": "EMPLOYEE_HANDBOOK",
    }
    code = aliases.get(code, code)
    if code not in _PACKET_BY_CODE:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown onboarding document type '{document_type}'",
        )
    return code


def _db_type(code: str) -> str:
    return _PACKET_BY_CODE[code]["dbType"]


def _filename_from_key(file_key: str) -> str:
    return file_key.rsplit("/", 1)[-1] if file_key else "document.pdf"


def ensure_template_in_minio() -> str:
    storage = get_storage()
    storage.ensure_bucket()
    try:
        storage.get_bytes(_TEMPLATE_OBJECT_KEY)
        return _TEMPLATE_OBJECT_KEY
    except HTTPException as exc:
        if exc.status_code != 404:
            raise
    if not _TEMPLATE_ASSET.is_file() and not _TEMPLATE_ASSET_FALLBACK.is_file():
        raise HTTPException(
            status_code=503,
            detail=f"Onboarding template missing at {_TEMPLATE_ASSET}",
        )
    source = _TEMPLATE_ASSET if _TEMPLATE_ASSET.is_file() else _TEMPLATE_ASSET_FALLBACK
    storage.put_bytes(_TEMPLATE_OBJECT_KEY, source.read_bytes(), "application/pdf")
    return _TEMPLATE_OBJECT_KEY


def _row_to_current_payload(row: EmployeeOnboardingPacketDocument | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {
        "id": str(row.id),
        "versionNumber": row.version_number,
        "status": PACKET_STATUS_UPLOADED,
        "fileName": _filename_from_key(row.file_key),
        "mimeType": "application/pdf",
        "sizeBytes": None,
        "uploadDate": row.uploaded_at.isoformat() if row.uploaded_at else None,
        "isCurrent": True,
        "signatureRequired": True,
    }


async def _latest_by_type(
    session: AsyncSession, employee_id: uuid.UUID
) -> dict[str, EmployeeOnboardingPacketDocument]:
    """Latest version per DB document_type."""
    result = await session.execute(
        select(EmployeeOnboardingPacketDocument)
        .where(EmployeeOnboardingPacketDocument.employee_id == employee_id)
        .order_by(
            EmployeeOnboardingPacketDocument.document_type.asc(),
            EmployeeOnboardingPacketDocument.version_number.desc(),
        )
    )
    latest: dict[str, EmployeeOnboardingPacketDocument] = {}
    for row in result.scalars().all():
        latest.setdefault(row.document_type, row)
    return latest


async def list_packet_documents(
    session: AsyncSession,
    *,
    employee_id: uuid.UUID,
) -> list[dict[str, Any]]:
    latest = await _latest_by_type(session, employee_id)
    items: list[dict[str, Any]] = []
    for spec in PACKET_SPECS:
        current = latest.get(spec["dbType"])
        items.append(
            {
                "documentType": spec["code"],
                "label": spec["label"],
                "signatureRequired": True,
                "status": PACKET_STATUS_UPLOADED if current else PACKET_STATUS_PENDING,
                "templateAvailable": True,
                "current": _row_to_current_payload(current),
            }
        )
    return items


async def download_template(document_type: str) -> tuple[bytes, str, str]:
    code = normalize_packet_type(document_type)
    key = ensure_template_in_minio()
    data, content_type = get_storage().get_bytes(key)
    return data, content_type or "application/pdf", _PACKET_BY_CODE[code]["downloadName"]


def _row_to_version_payload(row: EmployeeOnboardingPacketDocument) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "versionNumber": row.version_number,
        "fileName": _filename_from_key(row.file_key),
        "mimeType": "application/pdf",
        "sizeBytes": None,
        "uploadDate": row.uploaded_at.isoformat() if row.uploaded_at else None,
        "uploadedBy": str(row.uploaded_by_employee_id),
        "isCurrent": True,
        "status": PACKET_STATUS_UPLOADED,
    }


async def list_packet_versions(
    session: AsyncSession,
    *,
    employee_id: uuid.UUID,
    document_type: str,
) -> dict[str, Any]:
    code = normalize_packet_type(document_type)
    db_type = _db_type(code)
    result = await session.execute(
        select(EmployeeOnboardingPacketDocument)
        .where(
            EmployeeOnboardingPacketDocument.employee_id == employee_id,
            EmployeeOnboardingPacketDocument.document_type == db_type,
        )
        .order_by(EmployeeOnboardingPacketDocument.version_number.desc())
    )
    rows = list(result.scalars().all())
    return {
        "documentType": code,
        "label": _PACKET_BY_CODE[code]["label"],
        "versions": [_row_to_version_payload(row) for row in rows],
    }


async def download_current_upload(
    session: AsyncSession,
    *,
    employee_id: uuid.UUID,
    document_type: str,
) -> tuple[bytes, str, str]:
    code = normalize_packet_type(document_type)
    latest = await _latest_by_type(session, employee_id)
    row = latest.get(_db_type(code))
    if row is None:
        raise HTTPException(status_code=404, detail="No uploaded document for this type")
    data, content_type = get_storage().get_bytes(row.file_key)
    return data, content_type or "application/pdf", _filename_from_key(row.file_key)


async def download_packet_version(
    session: AsyncSession,
    *,
    employee_id: uuid.UUID,
    document_type: str,
    version_id: uuid.UUID,
) -> tuple[bytes, str, str]:
    code = normalize_packet_type(document_type)
    db_type = _db_type(code)
    result = await session.execute(
        select(EmployeeOnboardingPacketDocument).where(
            EmployeeOnboardingPacketDocument.id == version_id,
            EmployeeOnboardingPacketDocument.employee_id == employee_id,
            EmployeeOnboardingPacketDocument.document_type == db_type,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Document version not found")
    data, content_type = get_storage().get_bytes(row.file_key)
    return data, content_type or "application/pdf", _filename_from_key(row.file_key)


async def upload_packet_document(
    session: AsyncSession,
    *,
    employee: Employee,
    document_type: str,
    upload: UploadFile,
    actor: dict[str, Any],
) -> dict[str, Any]:
    code = normalize_packet_type(document_type)
    db_type = _db_type(code)
    data, content_type = await read_validated_upload(
        upload,
        allowed_types=PACKET_UPLOAD_CONTENT_TYPES,
        max_bytes=PACKET_UPLOAD_MAX_BYTES,
        kind="Onboarding document",
    )
    original_name = safe_filename(upload.filename or f"{code}.pdf")

    max_ver = (
        await session.execute(
            select(func.coalesce(func.max(EmployeeOnboardingPacketDocument.version_number), 0)).where(
                EmployeeOnboardingPacketDocument.employee_id == employee.id,
                EmployeeOnboardingPacketDocument.document_type == db_type,
            )
        )
    ).scalar_one()
    next_ver = int(max_ver) + 1

    try:
        actor_id = uuid.UUID(str(actor.get("employeeId") or actor.get("id")))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Actor employee id required") from exc

    object_key = (
        f"onboarding-packets/{employee.id}/{code}/v{next_ver}_{original_name}"
    )
    get_storage().ensure_bucket()
    get_storage().put_bytes(object_key, data, content_type or "application/pdf")

    row = EmployeeOnboardingPacketDocument(
        employee_id=employee.id,
        document_type=db_type,
        version_number=next_ver,
        file_key=object_key,
        uploaded_by_employee_id=actor_id,
    )
    session.add(row)
    await session.flush()

    try:
        from app.core.config import get_settings

        recipients = await notification_recipients("employees", "onboarding")
        if recipients:
            settings = get_settings()
            emp_code = (
                getattr(employee, "business_employee_id", None)
                or getattr(employee, "emp_id", None)
                or getattr(employee, "employee_code", None)
                or "—"
            )
            email = render(
                "onboarding.document_uploaded",
                employee_name=f"{employee.first_name} {employee.last_name}".strip() or "Employee",
                employee_code=str(emp_code),
                document=_PACKET_BY_CODE[code]["label"],
                version=str(next_ver),
                work_email=(getattr(employee, "official_email", None) or getattr(employee, "email_id", None) or "—"),
                employees_url=f"{settings.app_public_url.rstrip('/')}/employees",
            )
            for to_email in recipients:
                await send_email(
                    to_email=to_email,
                    subject=email.subject,
                    text_body=email.text_body,
                    html_body=email.html_body,
                    event="onboarding.document_uploaded",
                )
    except MailSendError as exc:
        logger.warning("onboarding packet notify skipped: %s", exc)
    except Exception:
        logger.exception("onboarding packet notify failed")

    return {
        "documentType": code,
        "label": _PACKET_BY_CODE[code]["label"],
        "signatureRequired": True,
        "status": PACKET_STATUS_UPLOADED,
        "templateAvailable": True,
        "current": _row_to_current_payload(row),
    }
