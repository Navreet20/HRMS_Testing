"""National ID number format validation (catalog regex + known fallbacks)."""

from __future__ import annotations

import re

from fastapi import HTTPException

# ICAO-style fallback when nationality is set but no country-specific rule exists.
GENERIC_PASSPORT_FORMAT = r"^[A-Z0-9]{6,9}$"

# Known patterns when catalog NUMBER_FORMAT is empty (country-agnostic types).
KNOWN_FORMATS: dict[str, str] = {
    "SSN": r"^\d{9}$",
    "AADHAAR": r"^\d{12}$",
    "PAN": r"^[A-Z]{5}\d{4}[A-Z]$",
    "DRIVERS_LICENSE": r"^[A-Z0-9]{5,20}$",
}

# Global document types whose format depends on employee nationality.
KNOWN_FORMATS_BY_COUNTRY: dict[str, dict[str, str]] = {
    "US": {
        "PASSPORT": r"^[A-Z0-9]{9}$",
    },
    "IN": {
        "PASSPORT": r"^[A-Z][0-9]{7}$",
    },
}


def normalize_national_id_number(number: str, document_type_code: str) -> str:
    """Normalize user input before regex validation."""
    code = document_type_code.strip().upper()
    text = number.strip()
    if code == "PAN":
        return text.upper().replace(" ", "")
    if code == "AADHAAR":
        return re.sub(r"\D", "", text)
    if code == "SSN":
        return re.sub(r"\D", "", text)
    if code in {"PASSPORT", "DRIVERS_LICENSE"}:
        return re.sub(r"[\s-]+", "", text).upper()
    return text


def resolve_national_id_format(
    catalog_format: str | None,
    document_type_code: str,
    country_code: str | None = None,
) -> str | None:
    """Return regex pattern for validation, or None when format is unknown."""
    text = (catalog_format or "").strip()
    if text:
        return text
    code = document_type_code.strip().upper()
    country = (country_code or "").strip().upper()
    if country:
        by_country = KNOWN_FORMATS_BY_COUNTRY.get(country, {})
        if code in by_country:
            return by_country[code]
        if code == "PASSPORT":
            return GENERIC_PASSPORT_FORMAT
    return KNOWN_FORMATS.get(code)


def validate_national_id_number(
    number: str,
    *,
    catalog_format: str | None,
    document_type_code: str,
    country_code: str | None = None,
) -> None:
    """Reject invalid national ID numbers server-side."""
    fmt = resolve_national_id_format(
        catalog_format,
        document_type_code,
        country_code,
    )
    if not fmt:
        return
    normalized = normalize_national_id_number(number, document_type_code)
    try:
        if not re.fullmatch(fmt, normalized):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"nationalIdNumber does not match format for "
                    f"{document_type_code.strip().upper()}"
                ),
            )
    except re.error as exc:
        raise HTTPException(
            status_code=400,
            detail="Invalid document type format configuration",
        ) from exc
