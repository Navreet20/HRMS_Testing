"""Onboarding packet document helpers (no review workflow)."""

from __future__ import annotations

import pytest

from app.modules.employee.onboarding_packets import (
    PACKET_DOCUMENT_TYPES,
    normalize_packet_type,
)


def test_packet_catalog_has_four_hr_docs() -> None:
    codes = [row["code"] for row in PACKET_DOCUMENT_TYPES]
    assert codes == [
        "NDA",
        "W4",
        "BANK_ACCOUNT_DETAILS",
        "EMPLOYEE_HANDBOOK",
    ]


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("nda", "NDA"),
        ("W-4", "W4"),
        ("bank_details", "BANK_ACCOUNT_DETAILS"),
        ("handbook", "EMPLOYEE_HANDBOOK"),
    ],
)
def test_normalize_packet_type_aliases(raw: str, expected: str) -> None:
    assert normalize_packet_type(raw) == expected


def test_normalize_packet_type_rejects_unknown() -> None:
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc:
        normalize_packet_type("PASSPORT")
    assert exc.value.status_code == 400


def test_version_payload_shape() -> None:
    from datetime import datetime, timezone
    from types import SimpleNamespace
    from uuid import uuid4

    from app.modules.employee.onboarding_packets import _row_to_version_payload

    row = SimpleNamespace(
        id=uuid4(),
        version_number=2,
        file_name="nda.pdf",
        mime_type="application/pdf",
        size_bytes=100,
        upload_date=datetime(2026, 9, 9, 12, 0, tzinfo=timezone.utc),
        created_by="Visalakshi A",
        is_current=True,
        status="Uploaded",
    )
    payload = _row_to_version_payload(row)
    assert payload["versionNumber"] == 2
    assert payload["fileName"] == "nda.pdf"
    assert payload["uploadedBy"] == "Visalakshi A"
    assert payload["isCurrent"] is True
    assert payload["uploadDate"].startswith("2026-09-09")
