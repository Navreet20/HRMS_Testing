"""Unit tests for EMP-1.1 profile field helpers."""

from __future__ import annotations

from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.core import field_crypto
from app.core.config import get_settings
from app.modules.employee.profile_fields import (
    apply_profile_fields,
    extract_address_emergency_payload,
    normalize_official_email_alias,
    profile_fields_to_dict,
    validate_address_shape,
    validate_common_fields,
    validate_create_required,
)


@pytest.fixture(autouse=True)
def _clear_crypto_caches(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("JWT_SECRET", "unit-test-secret-key-for-fernet")
    get_settings.cache_clear()
    field_crypto._fernet.cache_clear()
    yield
    get_settings.cache_clear()
    field_crypto._fernet.cache_clear()


def _valid_create_body(**overrides: object) -> dict:
    body: dict = {
        "firstName": "Ada",
        "lastName": "Lovelace",
        "emailId": "ada@example.com",
        "personalEmail": "ada.personal@example.com",
        "dateOfBirth": "1990-05-05",
        "phoneNumber": "+15550100",
    }
    body.update(overrides)
    return body


def test_validate_create_required_lists_missing_fields() -> None:
    with pytest.raises(HTTPException) as exc:
        validate_create_required({"firstName": "Ada"})
    assert exc.value.status_code == 400
    detail = str(exc.value.detail)
    assert "lastName" in detail
    assert "emailId" in detail
    assert "dateOfBirth" in detail
    assert "personalEmail" not in detail
    assert "phoneNumber" not in detail


def test_validate_create_required_ok() -> None:
    validate_create_required(_valid_create_body())


def test_validate_create_required_ok_without_personal_email() -> None:
    validate_create_required(
        {
            "firstName": "Ada",
            "lastName": "Lovelace",
            "emailId": "ada@example.com",
            "dateOfBirth": "1990-05-05",
        }
    )


def test_validate_create_required_ok_without_phone() -> None:
    validate_create_required(
        {
            "firstName": "Ada",
            "lastName": "Lovelace",
            "emailId": "ada@example.com",
            "dateOfBirth": "1990-05-05",
        }
    )


def test_validate_common_rejects_bad_name() -> None:
    with pytest.raises(HTTPException) as exc:
        validate_common_fields(_valid_create_body(firstName="Ada123"), is_create=True)
    assert exc.value.status_code == 400
    assert "firstName" in str(exc.value.detail)


def test_validate_common_rejects_future_dob() -> None:
    future = (date.today() + timedelta(days=3)).isoformat()
    with pytest.raises(HTTPException) as exc:
        validate_common_fields(_valid_create_body(dateOfBirth=future), is_create=True)
    assert "future" in str(exc.value.detail).lower()


def test_validate_common_rejects_underage_dob() -> None:
    today = date.today()
    try:
        underage = today.replace(year=today.year - 17)
    except ValueError:
        underage = today.replace(month=2, day=28, year=today.year - 17)
    with pytest.raises(HTTPException) as exc:
        validate_common_fields(
            _valid_create_body(dateOfBirth=underage.isoformat()), is_create=True
        )
    assert "18" in str(exc.value.detail)


def test_validate_common_accepts_exactly_18_dob() -> None:
    today = date.today()
    try:
        exactly_18 = today.replace(year=today.year - 18)
    except ValueError:
        exactly_18 = today.replace(month=2, day=28, year=today.year - 18)
    validate_common_fields(
        _valid_create_body(dateOfBirth=exactly_18.isoformat()), is_create=True
    )


def test_validate_common_rejects_over_max_age_dob() -> None:
    today = date.today()
    try:
        too_old = today.replace(year=today.year - 101)
    except ValueError:
        too_old = today.replace(month=2, day=28, year=today.year - 101)
    with pytest.raises(HTTPException) as exc:
        validate_common_fields(
            _valid_create_body(dateOfBirth=too_old.isoformat()), is_create=True
        )
    assert "100" in str(exc.value.detail)


def test_validate_common_rejects_short_phone() -> None:
    with pytest.raises(HTTPException) as exc:
        validate_common_fields(_valid_create_body(phoneNumber="123"), is_create=True)
    assert "phoneNumber" in str(exc.value.detail)


def test_validate_common_rejects_invalid_gender() -> None:
    with pytest.raises(HTTPException) as exc:
        validate_common_fields(
            _valid_create_body(gender="ALIEN"), is_create=True
        )
    assert "gender" in str(exc.value.detail)


def test_validate_common_normalizes_employment_type() -> None:
    body = _valid_create_body(employmentType="full-time")
    validate_common_fields(body, is_create=True)
    assert body["employmentType"] == "FULL_TIME"
    assert body["workerType"] == "EMPLOYEE"
    assert body["workSchedule"] == "FULL_TIME"
    assert body["employmentCategory"] == "REGULAR"


def test_validate_common_derives_temporary_from_classification() -> None:
    body = _valid_create_body(
        workerType="EMPLOYEE",
        workSchedule="PART_TIME",
        employmentCategory="TEMPORARY",
    )
    validate_common_fields(body, is_create=True)
    assert body["employmentType"] == "TEMPORARY"
    assert body["workSchedule"] == "PART_TIME"


def test_validate_address_rejects_address_type() -> None:
    with pytest.raises(HTTPException) as exc:
        validate_address_shape({"addressType": "HOME", "addressLine1": "1 Main"})
    assert "addressType" in str(exc.value.detail)


def test_extract_address_emergency_maps_canonical_aliases() -> None:
    payload = extract_address_emergency_payload(
        {
            "addressLine1": "1 Main",
            "city": "Austin",
            "state": "TX",
            "zipCode": "78701",
            "country": "US",
            "emergencyContactName": "Pat",
            "emergencyContactPhone": "+15551234567",
            "emergencyContactRelation": "Sibling",
            "emergencyContactEmail": "pat@example.com",
            "linkedEmployeeId": None,
        }
    )
    assert payload["addressLine1"] == "1 Main"
    assert payload["emergencyName"] == "Pat"
    assert payload["emergencyPhone"] == "+15551234567"
    assert payload["emergencyRelation"] == "Sibling"
    assert payload["emergencyEmail"] == "pat@example.com"


def test_extract_address_emergency_includes_personal_tab_fields() -> None:
    payload = extract_address_emergency_payload(
        {
            "gender": "FEMALE",
            "maritalStatus": "SINGLE",
            "nationality": "IN",
            "ethnicity": "ASIAN",
            "personalEmail": "navreet.personal@example.test",
            "phoneNumber": "+14155550100",
            "alternatePhoneNumber": "+14155550199",
            "addressLine1": "42 Maple Ave",
            "city": "Austin",
            "state": "TX",
            "postalCode": "78701",
            "country": "US",
        }
    )
    assert payload["gender"] == "FEMALE"
    assert payload["maritalStatus"] == "SINGLE"
    assert payload["nationality"] == "IN"
    assert payload["ethnicity"] == "ASIAN"
    assert payload["personalEmail"] == "navreet.personal@example.test"
    assert payload["phoneNumber"] == "+14155550100"
    assert payload["alternatePhoneNumber"] == "+14155550199"
    assert payload["addressLine1"] == "42 Maple Ave"
    assert payload["country"] == "US"


def test_validate_common_fields_coerces_emergency_phone_placeholder() -> None:
    """Legacy em-dash placeholders must not 400 on Admin/HR View/Edit save."""
    body = {
        "emergencyName": "Pat Lee",
        "emergencyPhone": "—",
        "emergencyRelation": "Other",
    }
    validate_common_fields(body, is_create=False)
    assert body["emergencyPhone"] is None


def test_is_emergency_name_placeholder() -> None:
    from app.modules.employee.profile_fields import is_emergency_name_placeholder

    assert is_emergency_name_placeholder("") is True
    assert is_emergency_name_placeholder("Emergency contact") is True
    assert is_emergency_name_placeholder("Emergency Contact") is True
    assert is_emergency_name_placeholder("Pat Lee") is False


def test_validate_common_fields_rejects_invalid_emergency_phone() -> None:
    with pytest.raises(HTTPException) as exc:
        validate_common_fields({"emergencyPhone": "not-a-phone"}, is_create=False)
    assert exc.value.status_code == 400
    assert "emergencyPhone" in str(exc.value.detail)


def test_normalize_official_email_alias() -> None:
    body = normalize_official_email_alias(
        {"officialEmail": "hr@example.com", "firstName": "Ada"}
    )
    assert body["emailId"] == "hr@example.com"
    trimmed = normalize_official_email_alias(
        {"officialEmail": "  ada@gmail.com  ", "emailId": "ignored@example.com"}
    )
    assert trimmed["emailId"] == "ada@gmail.com"


def test_apply_rejects_invalid_work_mode() -> None:
    emp = MagicMock()
    with pytest.raises(HTTPException) as exc:
        apply_profile_fields(emp, {"workMode": "WFH"})
    assert exc.value.status_code == 400
    assert "workMode" in str(exc.value.detail)


def test_apply_profile_scalar_fields_without_national_id_encryption() -> None:
    emp = MagicMock()
    emp.national_id_country = None
    apply_profile_fields(
        emp,
        {
            "maritalStatus": "married",
            "workMode": "hybrid",
            "nationality": "US",
            "gender": "female",
            "alternatePhoneNumber": "+1-555-0199",
            "probationEndDate": "2026-12-31",
            "gradeBand": "L3",
            "assignedCountry": "US",
            "nationalIdCountry": "US",
            "timesheetRequired": True,
        },
    )
    assert emp.marital_status == "MARRIED"
    assert emp.work_mode == "HYBRID"
    assert emp.gender == "FEMALE"
    assert emp.nationality == "US"
    assert emp.assigned_country == "US"
    assert emp.national_id_country is None
    assert emp.timesheet_required is True


def test_profile_fields_to_dict_masks_national_id() -> None:
    emp = SimpleNamespace(
        email_id="ada@company.com",
        middle_name="X",
        gender="FEMALE",
        marital_status="SINGLE",
        date_of_birth="1990-05-05",
        phone_number="+15550100",
        alternate_phone_number=None,
        nationality="US",
        national_id_country="US",
        national_id_number_encrypted="encrypted-token",
        national_id_last4="6789",
        national_id_document_type="SSN",
        national_id_verification_status="PENDING",
        employee_immigration_status="H1B",
        passport_number="X1234567",
        passport_issuing_country_authority="US",
        passport_start_date="2020-01-15",
        passport_expiration_date="2030-01-14",
        work_mode="REMOTE",
        payroll_start_date=None,
        timesheet_required=True,
        probation_end_date=None,
        grade_band="L2",
        job_rank="RANK_7",
        assigned_country="US",
        avatar_object_key="employees/1/avatar/a.png",
    )
    data = profile_fields_to_dict(emp)
    assert data["officialEmail"] == "ada@company.com"
    assert data["nationalIdLast4"] == "6789"
    assert data["nationalIdVerificationStatus"] == "PENDING"
    assert data["hasNationalId"] is True
    assert "nationalIdNumber" not in data
    assert data["employeeImmigrationStatus"] == "H1B"
    assert data["passportNumber"] == "X1234567"
    assert data["passportIssuingCountryAuthority"] == "US"
    assert data["passportStartDate"] == "2020-01-15"
    assert data["passportExpirationDate"] == "2030-01-14"
    assert data["workMode"] == "REMOTE"
    assert data["timesheetRequired"] is True
    assert data["gradeBand"] == "L2"
    assert data["photoUrl"] == "employees/1/avatar/a.png"


def test_profile_fields_to_dict_unmasks_with_permission_flag() -> None:
    token = field_crypto.encrypt_field("123-45-6789")
    emp = SimpleNamespace(
        email_id="ada@company.com",
        middle_name=None,
        gender=None,
        marital_status=None,
        date_of_birth=None,
        phone_number=None,
        alternate_phone_number=None,
        nationality=None,
        national_id_country="US",
        national_id_number_encrypted=token,
        national_id_last4="6789",
        national_id_document_type="SSN",
        national_id_verification_status="PENDING",
        work_mode=None,
        probation_end_date=None,
        grade_band=None,
        job_rank=None,
        assigned_country=None,
        avatar_object_key=None,
    )
    data = profile_fields_to_dict(emp, include_full_national_id=True)
    assert data["nationalIdNumber"] == "123-45-6789"


def test_profile_fields_grade_band_falls_back_to_job_rank() -> None:
    emp = SimpleNamespace(
        email_id="ada@company.com",
        middle_name=None,
        gender=None,
        marital_status=None,
        date_of_birth=None,
        phone_number=None,
        alternate_phone_number=None,
        nationality=None,
        national_id_country=None,
        national_id_number_encrypted=None,
        national_id_last4=None,
        work_mode=None,
        probation_end_date=None,
        grade_band=None,
        job_rank="RANK_3",
        assigned_country=None,
        avatar_object_key=None,
    )
    data = profile_fields_to_dict(emp)
    assert data["gradeBand"] == "RANK_3"
    assert data["photoUrl"] is None
