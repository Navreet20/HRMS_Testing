"""Correction request create/list helpers (unit, no DB)."""

from __future__ import annotations

from app.modules.employee.field_permissions import (
    CORRECTION_REQUEST_FIELDS,
    allows_correction_request,
)


def test_correction_fields_are_name_and_dob_only() -> None:
    assert "firstName" in CORRECTION_REQUEST_FIELDS
    assert "lastName" in CORRECTION_REQUEST_FIELDS
    assert "dateOfBirth" in CORRECTION_REQUEST_FIELDS
    assert "nationalIdNumber" not in CORRECTION_REQUEST_FIELDS
    assert allows_correction_request("middleName") is True
    assert allows_correction_request("gender") is False
