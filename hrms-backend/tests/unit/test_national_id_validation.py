"""Unit tests for national ID format validation."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.modules.employee.national_id_validation import (
    normalize_national_id_number,
    resolve_national_id_format,
    validate_national_id_number,
)


def test_resolve_prefers_catalog_format() -> None:
    assert resolve_national_id_format(r"^\d{4}$", "SSN") == r"^\d{4}$"


def test_resolve_falls_back_to_ssn() -> None:
    assert resolve_national_id_format(None, "SSN") == r"^\d{9}$"


def test_resolve_falls_back_to_aadhaar() -> None:
    assert resolve_national_id_format("", "AADHAAR") == r"^\d{12}$"


def test_resolve_us_passport_by_country() -> None:
    assert (
        resolve_national_id_format(None, "PASSPORT", "US")
        == r"^[A-Z0-9]{9}$"
    )


def test_resolve_in_passport_by_country() -> None:
    assert (
        resolve_national_id_format(None, "PASSPORT", "IN")
        == r"^[A-Z][0-9]{7}$"
    )


def test_resolve_passport_without_country_is_unknown() -> None:
    assert resolve_national_id_format(None, "PASSPORT") is None


def test_resolve_generic_passport_for_other_countries() -> None:
    assert (
        resolve_national_id_format(None, "PASSPORT", "GB")
        == r"^[A-Z0-9]{6,9}$"
    )
    assert (
        resolve_national_id_format(None, "PASSPORT", "OTHER")
        == r"^[A-Z0-9]{6,9}$"
    )


def test_resolve_falls_back_to_drivers_license() -> None:
    assert (
        resolve_national_id_format(None, "DRIVERS_LICENSE")
        == r"^[A-Z0-9]{5,20}$"
    )


def test_validate_accepts_ssn_with_dashes() -> None:
    validate_national_id_number(
        "123-45-6789",
        catalog_format=None,
        document_type_code="SSN",
    )


def test_validate_accepts_ssn_digits_only() -> None:
    validate_national_id_number(
        "123456789",
        catalog_format=None,
        document_type_code="SSN",
    )


def test_validate_rejects_bad_ssn() -> None:
    with pytest.raises(HTTPException) as exc:
        validate_national_id_number(
            "12345",
            catalog_format=None,
            document_type_code="SSN",
        )
    assert exc.value.status_code == 400
    assert "SSN" in str(exc.value.detail)


def test_validate_rejects_ssn_with_more_than_nine_digits() -> None:
    with pytest.raises(HTTPException) as exc:
        validate_national_id_number(
            "1234567890",
            catalog_format=None,
            document_type_code="SSN",
        )
    assert exc.value.status_code == 400
    assert "SSN" in str(exc.value.detail)


def test_validate_accepts_aadhaar() -> None:
    validate_national_id_number(
        "123456789012",
        catalog_format=None,
        document_type_code="AADHAAR",
    )


def test_validate_accepts_pan_lowercase_input() -> None:
    validate_national_id_number(
        "abcde1234f",
        catalog_format=None,
        document_type_code="PAN",
    )


def test_validate_rejects_bad_pan() -> None:
    with pytest.raises(HTTPException) as exc:
        validate_national_id_number(
            "ABC123",
            catalog_format=None,
            document_type_code="PAN",
        )
    assert exc.value.status_code == 400
    assert "PAN" in str(exc.value.detail)


def test_validate_accepts_us_passport() -> None:
    validate_national_id_number(
        "123456789",
        catalog_format=None,
        document_type_code="PASSPORT",
        country_code="US",
    )


def test_validate_rejects_bad_us_passport() -> None:
    with pytest.raises(HTTPException) as exc:
        validate_national_id_number(
            "ABC12",
            catalog_format=None,
            document_type_code="PASSPORT",
            country_code="US",
        )
    assert exc.value.status_code == 400
    assert "PASSPORT" in str(exc.value.detail)


def test_validate_accepts_in_passport() -> None:
    validate_national_id_number(
        "a1234567",
        catalog_format=None,
        document_type_code="PASSPORT",
        country_code="IN",
    )


def test_validate_rejects_bad_in_passport() -> None:
    with pytest.raises(HTTPException) as exc:
        validate_national_id_number(
            "1234567890",
            catalog_format=None,
            document_type_code="PASSPORT",
            country_code="IN",
        )
    assert exc.value.status_code == 400
    assert "PASSPORT" in str(exc.value.detail)


def test_validate_accepts_us_drivers_license() -> None:
    validate_national_id_number(
        "d123-4567",
        catalog_format=None,
        document_type_code="DRIVERS_LICENSE",
        country_code="US",
    )


def test_validate_rejects_bad_drivers_license() -> None:
    with pytest.raises(HTTPException) as exc:
        validate_national_id_number(
            "ABC",
            catalog_format=None,
            document_type_code="DRIVERS_LICENSE",
            country_code="US",
        )
    assert exc.value.status_code == 400
    assert "DRIVERS_LICENSE" in str(exc.value.detail)


def test_validate_skips_passport_without_country() -> None:
    validate_national_id_number(
        "X1234567",
        catalog_format=None,
        document_type_code="PASSPORT",
    )


def test_validate_accepts_generic_passport_for_other_countries() -> None:
    validate_national_id_number(
        "ab123456",
        catalog_format=None,
        document_type_code="PASSPORT",
        country_code="GB",
    )


def test_validate_rejects_short_passport_for_other_countries() -> None:
    with pytest.raises(HTTPException) as exc:
        validate_national_id_number(
            "AB12",
            catalog_format=None,
            document_type_code="PASSPORT",
            country_code="DE",
        )
    assert exc.value.status_code == 400
    assert "PASSPORT" in str(exc.value.detail)


def test_normalize_passport_and_drivers_license() -> None:
    assert normalize_national_id_number("abc-123", "PASSPORT") == "ABC123"
    assert (
        normalize_national_id_number("d 123-4567", "DRIVERS_LICENSE")
        == "D1234567"
    )
