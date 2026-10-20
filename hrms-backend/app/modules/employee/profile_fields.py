"""EMP-1.1 employee profile / employment context fields.

National ID is encrypted at rest (Fernet). API responses expose last4 only.
``email_id`` is the HR-provisioned official/login email (serialized as both
``emailId`` and ``officialEmail``).
"""

from __future__ import annotations

import re
from datetime import date
from typing import Any

from fastapi import HTTPException

from app.core.field_crypto import decrypt_field
from app.modules.employee.employment_classification import (
    EMPLOYMENT_TYPES,
    apply_employment_classification,
    classification_fields_from_employee,
    normalize_employment_classification,
)

WORK_MODES = frozenset({"REMOTE", "HYBRID", "ONSITE"})
MIN_EMPLOYEE_AGE = 18
MAX_EMPLOYEE_AGE = 100
MARITAL_STATUSES = frozenset({"SINGLE", "MARRIED", "DIVORCED", "WIDOWED", "OTHER"})
ETHNICITIES = frozenset(
    {
        "PREFER_NOT_TO_SAY",
        "ASIAN",
        "BLACK_OR_AFRICAN_AMERICAN",
        "HISPANIC_OR_LATINO",
        "WHITE",
        "NATIVE_AMERICAN",
        "PACIFIC_ISLANDER",
        "TWO_OR_MORE",
        "OTHER",
    }
)
GENDERS = frozenset(
    {"MALE", "FEMALE", "NON_BINARY", "OTHER", "UNSPECIFIED", "PREFER_NOT_TO_SAY"}
)
# ISO 3166-1 alpha-2 — nationality and address country share this controlled list.
COUNTRY_CODES = frozenset(
    {
        "US",
        "CA",
        "MX",
        "GB",
        "IE",
        "IN",
        "AU",
        "NZ",
        "DE",
        "FR",
        "ES",
        "IT",
        "NL",
        "BE",
        "CH",
        "AT",
        "SE",
        "NO",
        "DK",
        "FI",
        "PL",
        "PT",
        "BR",
        "AR",
        "CL",
        "CO",
        "PE",
        "JP",
        "KR",
        "CN",
        "HK",
        "TW",
        "SG",
        "MY",
        "TH",
        "PH",
        "ID",
        "VN",
        "AE",
        "SA",
        "QA",
        "KW",
        "BH",
        "OM",
        "ZA",
        "NG",
        "KE",
        "EG",
        "IL",
        "TR",
        "RU",
        "UA",
        "PK",
        "BD",
        "LK",
        "NP",
        "OTHER",
    }
)
NATIONALITIES = COUNTRY_CODES
ADDRESS_COUNTRIES = COUNTRY_CODES

ADDRESS_FIELD_KEYS = frozenset(
    {
        "addressLine1",
        "addressLine2",
        "city",
        "state",
        "postalCode",
        "country",
    }
)
_ADDRESS_FORBIDDEN_KEYS = frozenset({"addressType", "addressStatus"})

EMERGENCY_FIELD_KEYS = frozenset(
    {
        "emergencyName",
        "emergencyPhone",
        "emergencyRelation",
        "emergencyEmail",
        "emergencyEmployeeId",
        # Canonical aliases (snake_case → camelCase 1:1)
        "emergencyContactName",
        "emergencyContactPhone",
        "emergencyContactRelation",
        "emergencyContactEmail",
        "linkedEmployeeId",
        "alternateEmergencyName",
        "alternateEmergencyPhone",
        "alternateEmergencyRelation",
        "alternateEmergencyEmail",
    }
)

# HR create shell — personalEmail moves to employee self-onboarding (Flow 2).
_CREATE_REQUIRED = (
    "firstName",
    "lastName",
    "emailId",
    "dateOfBirth",
)

# EMP-DATA-2: firstName + lastName is sufficient for employee_code on draft.
_DRAFT_REQUIRED = (
    "firstName",
    "lastName",
)

_NAME_RE = re.compile(r"^[A-Za-z][A-Za-z \-']{0,49}$")
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_PHONE_RE = re.compile(r"^\+?\d{7,15}$")
# Legacy / UI display placeholders that must not be treated as real phone numbers.
_PHONE_PLACEHOLDERS = frozenset({"—", "–", "-"})
# Legacy default stored when no emergency name was provided (NOT NULL column).
_EMERGENCY_NAME_PLACEHOLDERS = frozenset({"emergency contact"})


def is_emergency_name_placeholder(value: Any) -> bool:
    """True when value is empty or the legacy auto-filled emergency contact name."""
    text = str(value or "").strip()
    return not text or text.casefold() in _EMERGENCY_NAME_PLACEHOLDERS


def is_phone_placeholder(value: Any) -> bool:
    """True when value is an empty or em-dash style phone placeholder."""
    text = str(value or "").strip()
    return not text or text in _PHONE_PLACEHOLDERS


def coerce_phone_placeholders(body: dict[str, Any]) -> None:
    """Replace UI/legacy phone placeholders with None so PATCH re-saves succeed."""
    phone_keys = (
        "phoneNumber",
        "alternatePhoneNumber",
        "emergencyPhone",
        "emergencyContactPhone",
        "alternateEmergencyPhone",
    )
    for key in phone_keys:
        if key in body and is_phone_placeholder(body.get(key)):
            body[key] = None
    contact = body.get("contact")
    if isinstance(contact, dict):
        for key in (
            "phone",
            "alternatePhone",
            "emergencyPhone",
            "emergencyContactPhone",
            "alternateEmergencyPhone",
        ):
            if key in contact and is_phone_placeholder(contact.get(key)):
                contact[key] = None


def normalize_official_email_alias(body: dict[str, Any]) -> dict[str, Any]:
    """Map ``officialEmail`` → ``emailId`` for storage; prefer official when both set."""
    out = dict(body)
    official = _optional_str(out.get("officialEmail")) if "officialEmail" in out else None
    email_id = _optional_str(out.get("emailId")) if "emailId" in out else None
    if official is not None:
        out["emailId"] = official
    elif email_id is not None:
        out["emailId"] = email_id
    return out


def validate_create_required(body: dict[str, Any]) -> None:
    missing = [
        key
        for key in _CREATE_REQUIRED
        if not str(body.get(key) or "").strip()
    ]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required field(s): {', '.join(missing)}",
        )


def validate_draft_required(body: dict[str, Any]) -> None:
    """EMP-DATA-2: firstName + lastName required to save a draft."""
    missing = [
        key
        for key in _DRAFT_REQUIRED
        if not str(body.get(key) or "").strip()
    ]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required field(s) for draft: {', '.join(missing)}",
        )


def validate_common_fields_for_draft(body: dict[str, Any]) -> None:
    """Relaxed validation for draft create/update (no official email / phone required)."""
    coerce_phone_placeholders(body)
    if "firstName" in body and body.get("firstName") is not None:
        _validate_name(body.get("firstName"), field="firstName")
    if "lastName" in body and body.get("lastName") is not None:
        _validate_name(body.get("lastName"), field="lastName")
    if "dateOfBirth" in body:
        dob = _validate_date_of_birth(body.get("dateOfBirth"), required=False)
        if dob is not None:
            body["dateOfBirth"] = dob
    if "personalEmail" in body and body.get("personalEmail") is not None:
        if str(body.get("personalEmail") or "").strip():
            body["personalEmail"] = _validate_email(
                body.get("personalEmail"), field="personalEmail"
            )
        else:
            body["personalEmail"] = None
    if "emailId" in body or "officialEmail" in body:
        raw = body.get("emailId") if "emailId" in body else body.get("officialEmail")
        if raw is not None and str(raw).strip():
            body["emailId"] = _validate_email(raw, field="officialEmail")
    if "phoneNumber" in body and body.get("phoneNumber") is not None:
        if str(body.get("phoneNumber") or "").strip():
            body["phoneNumber"] = _validate_phone(body.get("phoneNumber"))
        else:
            body["phoneNumber"] = None
    if "gender" in body and body.get("gender") is not None:
        body["gender"] = _normalize_enum(
            body.get("gender"), field="gender", allowed=GENDERS
        )
    if any(
        key in body
        for key in (
            "employmentType",
            "workerType",
            "workSchedule",
            "employmentCategory",
        )
    ):
        normalize_employment_classification(body)
    validate_address_shape(body)


def _optional_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _normalize_enum(value: Any, *, field: str, allowed: frozenset[str]) -> str | None:
    text = _optional_str(value)
    if text is None:
        return None
    normalized = text.upper().replace(" ", "_").replace("-", "_")
    if normalized not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {field}; allowed: {', '.join(sorted(allowed))}",
        )
    return normalized


def _validate_name(value: Any, *, field: str) -> str:
    text = _optional_str(value)
    if text is None:
        raise HTTPException(status_code=400, detail=f"{field} is required")
    if not _NAME_RE.fullmatch(text):
        raise HTTPException(
            status_code=400,
            detail=(
                f"{field} must be 1–50 characters and contain only letters, "
                "spaces, hyphens, or apostrophes"
            ),
        )
    return text


def _validate_email(value: Any, *, field: str) -> str:
    text = _optional_str(value)
    if text is None:
        raise HTTPException(status_code=400, detail=f"{field} is required")
    if not _EMAIL_RE.fullmatch(text) or len(text) > 254:
        raise HTTPException(status_code=400, detail=f"Invalid {field}")
    return text


def _validate_optional_email(value: Any, *, field: str) -> str | None:
    text = _optional_str(value)
    if text is None:
        return None
    if not _EMAIL_RE.fullmatch(text) or len(text) > 254:
        raise HTTPException(status_code=400, detail=f"Invalid {field}")
    if field in {"emergencyEmail", "emergencyContactEmail"}:
        if "@" not in text or ".com" not in text.casefold():
            raise HTTPException(
                status_code=400,
                detail="Enter a valid email",
            )
    return text


def _validate_phone(value: Any, *, field: str = "phoneNumber") -> str:
    text = _optional_str(value)
    if text is None:
        raise HTTPException(status_code=400, detail=f"{field} is required")
    compact = re.sub(r"[\s\-().]", "", text)
    if not _PHONE_RE.fullmatch(compact):
        raise HTTPException(
            status_code=400,
            detail=f"{field} must be 7–15 digits with an optional leading +",
        )
    return compact


def _validate_date_of_birth(value: Any, *, required: bool) -> str | None:
    text = _optional_str(value)
    if text is None:
        if required:
            raise HTTPException(status_code=400, detail="dateOfBirth is required")
        return None
    try:
        parsed = date.fromisoformat(text[:10])
    except ValueError as exc:
        raise HTTPException(
            status_code=400, detail="dateOfBirth must be a valid ISO date (YYYY-MM-DD)"
        ) from exc
    today = date.today()
    if parsed > today:
        raise HTTPException(status_code=400, detail="dateOfBirth cannot be in the future")
    try:
        adult_threshold = today.replace(year=today.year - 18)
    except ValueError:
        # Feb 29 on a non-leap adult year → Feb 28
        adult_threshold = today.replace(month=2, day=28, year=today.year - 18)
    if parsed > adult_threshold:
        raise HTTPException(
            status_code=400,
            detail="dateOfBirth must be at least 18 years ago",
        )
    try:
        oldest_threshold = today.replace(year=today.year - MAX_EMPLOYEE_AGE)
    except ValueError:
        oldest_threshold = today.replace(
            month=2, day=28, year=today.year - MAX_EMPLOYEE_AGE
        )
    if parsed < oldest_threshold:
        raise HTTPException(
            status_code=400,
            detail=f"dateOfBirth cannot be more than {MAX_EMPLOYEE_AGE} years ago",
        )
    return parsed.isoformat()


def _contact_section(body: dict[str, Any]) -> dict[str, Any]:
    contact = body.get("contact")
    if isinstance(contact, dict):
        return contact
    return body


def validate_address_shape(body: dict[str, Any]) -> None:
    """Reject address_type / address-row status; allow only the six address fields."""
    section = _contact_section(body)
    forbidden = sorted(
        key for key in _ADDRESS_FORBIDDEN_KEYS if key in section or key in body
    )
    if forbidden:
        raise HTTPException(
            status_code=400,
            detail=f"Address extras not allowed: {', '.join(forbidden)}",
        )
    if "country" in section or ("country" in body and not isinstance(body.get("contact"), dict)):
        raw = section.get("country") if "country" in section else body.get("country")
        if raw is not None and str(raw).strip():
            _normalize_enum(raw, field="country", allowed=ADDRESS_COUNTRIES)


def extract_address_emergency_payload(body: dict[str, Any]) -> dict[str, Any]:
    """Pull address, emergency, and Personal-tab employee fields for profile writes."""
    section = _contact_section(body)
    nested = isinstance(body.get("contact"), dict)
    out: dict[str, Any] = {}

    def _pick(key: str) -> bool:
        if key in section:
            out[key] = section.get(key)
            return True
        if not nested and key in body:
            out[key] = body.get(key)
            return True
        return False

    for key in ADDRESS_FIELD_KEYS:
        _pick(key)

    # Canonical storage keys used by _apply_profile_payload.
    # Include employee-row personal/contact fields so a Personal-tab PATCH
    # persists demographics and phones, not only ADDRESS / EMERGENCY_CONTACT.
    for key in (
        "emergencyName",
        "emergencyPhone",
        "emergencyRelation",
        "emergencyEmail",
        "emergencyEmployeeId",
        "alternateEmergencyName",
        "alternateEmergencyPhone",
        "alternateEmergencyRelation",
        "alternateEmergencyEmail",
        "personalEmail",
        "phone",
        "phoneNumber",
        "alternatePhone",
        "alternatePhoneNumber",
        "gender",
        "maritalStatus",
        "nationality",
        "ethnicity",
    ):
        _pick(key)

    alias_map = {
        "emergencyContactName": "emergencyName",
        "emergencyContactPhone": "emergencyPhone",
        "emergencyContactRelation": "emergencyRelation",
        "emergencyContactEmail": "emergencyEmail",
        "linkedEmployeeId": "emergencyEmployeeId",
    }
    for alias, canonical in alias_map.items():
        if canonical in out:
            continue
        if alias in section:
            out[canonical] = section.get(alias)
        elif not nested and alias in body:
            out[canonical] = body.get(alias)
    return out


def validate_common_fields(body: dict[str, Any], *, is_create: bool) -> None:
    """Validate Dev-2 common profile / contact fields on create or update."""
    coerce_phone_placeholders(body)
    if is_create or "firstName" in body:
        if is_create or body.get("firstName") is not None:
            _validate_name(body.get("firstName"), field="firstName")
    if is_create or "lastName" in body:
        if is_create or body.get("lastName") is not None:
            _validate_name(body.get("lastName"), field="lastName")

    if is_create or "dateOfBirth" in body:
        dob = _validate_date_of_birth(body.get("dateOfBirth"), required=is_create)
        if dob is not None:
            body["dateOfBirth"] = dob

    # personalEmail is optional on HR create; required only when provided.
    if "personalEmail" in body:
        raw_personal = body.get("personalEmail")
        if raw_personal is not None and str(raw_personal).strip():
            body["personalEmail"] = _validate_email(
                raw_personal, field="personalEmail"
            )
        else:
            body["personalEmail"] = None

    if is_create or "emailId" in body or "officialEmail" in body:
        if is_create or body.get("emailId") is not None or body.get("officialEmail") is not None:
            body["emailId"] = _validate_email(body.get("emailId"), field="officialEmail")

    if "phoneNumber" in body and body.get("phoneNumber") is not None:
        if str(body.get("phoneNumber") or "").strip():
            body["phoneNumber"] = _validate_phone(body.get("phoneNumber"))
        else:
            body["phoneNumber"] = None

    if "gender" in body and body.get("gender") is not None:
        body["gender"] = _normalize_enum(
            body.get("gender"), field="gender", allowed=GENDERS
        )
    if "nationality" in body and body.get("nationality") is not None:
        body["nationality"] = _normalize_enum(
            body.get("nationality"), field="nationality", allowed=NATIONALITIES
        )
    if "maritalStatus" in body and body.get("maritalStatus") is not None:
        body["maritalStatus"] = _normalize_enum(
            body.get("maritalStatus"),
            field="maritalStatus",
            allowed=MARITAL_STATUSES,
        )
    if "ethnicity" in body and body.get("ethnicity") is not None:
        body["ethnicity"] = _normalize_enum(
            body.get("ethnicity"),
            field="ethnicity",
            allowed=ETHNICITIES,
        )
    if any(
        key in body
        for key in (
            "employmentType",
            "workerType",
            "workSchedule",
            "employmentCategory",
        )
    ):
        normalize_employment_classification(body)

    validate_address_shape(body)

    emergency = extract_address_emergency_payload(body)
    if "emergencyEmail" in emergency and emergency.get("emergencyEmail") is not None:
        emergency["emergencyEmail"] = _validate_optional_email(
            emergency.get("emergencyEmail"), field="emergencyEmail"
        )
    if (
        "alternateEmergencyEmail" in emergency
        and emergency.get("alternateEmergencyEmail") is not None
    ):
        emergency["alternateEmergencyEmail"] = _validate_optional_email(
            emergency.get("alternateEmergencyEmail"),
            field="alternateEmergencyEmail",
        )
    if "emergencyPhone" in emergency and emergency.get("emergencyPhone") is not None:
        if str(emergency.get("emergencyPhone") or "").strip():
            emergency["emergencyPhone"] = _validate_phone(
                emergency.get("emergencyPhone"), field="emergencyPhone"
            )
            # Keep body in sync so later writers see the normalized value.
            if "emergencyPhone" in body:
                body["emergencyPhone"] = emergency["emergencyPhone"]
            if "emergencyContactPhone" in body:
                body["emergencyContactPhone"] = emergency["emergencyPhone"]
            contact = body.get("contact")
            if isinstance(contact, dict):
                if "emergencyPhone" in contact:
                    contact["emergencyPhone"] = emergency["emergencyPhone"]
                if "emergencyContactPhone" in contact:
                    contact["emergencyContactPhone"] = emergency["emergencyPhone"]
        else:
            if "emergencyPhone" in body:
                body["emergencyPhone"] = None
            if "emergencyContactPhone" in body:
                body["emergencyContactPhone"] = None


def apply_profile_fields(emp: Any, body: dict[str, Any]) -> None:
    """Apply EMP-1.1 scalar fields from a create/update body onto ``emp``."""
    simple: list[tuple[str, str]] = [
        ("middleName", "middle_name"),
        ("dateOfBirth", "date_of_birth"),
        ("phoneNumber", "phone_number"),
        ("alternatePhoneNumber", "alternate_phone_number"),
        ("probationEndDate", "probation_end_date"),
        ("gradeBand", "grade_band"),
        ("assignedCountry", "assigned_country"),
    ]
    for key, attr in simple:
        if key not in body:
            continue
        value = body.get(key)
        if attr in {"date_of_birth", "probation_end_date"} and value not in (None, ""):
            # New schema stores real DATE columns (old schema used strings).
            from app.modules.employee.joining_status import parse_joining_date

            parsed = parse_joining_date(str(value))
            setattr(emp, attr, parsed)
        else:
            setattr(emp, attr, _optional_str(value))

    if "gender" in body:
        emp.gender = _normalize_enum(
            body.get("gender"), field="gender", allowed=GENDERS
        )
    if "nationality" in body:
        emp.nationality = _normalize_enum(
            body.get("nationality"), field="nationality", allowed=NATIONALITIES
        )

    if "maritalStatus" in body:
        emp.marital_status = _normalize_enum(
            body.get("maritalStatus"),
            field="maritalStatus",
            allowed=MARITAL_STATUSES,
        )

    if "workMode" in body:
        raw_mode = body.get("workMode")
        if isinstance(raw_mode, str) and raw_mode.strip().upper().replace(" ", "_").replace(
            "-", "_"
        ) in {"IN_PERSON", "INPERSON"}:
            raw_mode = "ONSITE"
        emp.work_mode = _normalize_enum(
            raw_mode,
            field="workMode",
            allowed=WORK_MODES,
        )

    if "ethnicity" in body:
        emp.ethnicity = _normalize_enum(
            body.get("ethnicity"),
            field="ethnicity",
            allowed=ETHNICITIES,
        )

    if "payrollStartDate" in body:
        raw = body.get("payrollStartDate")
        if raw in (None, ""):
            emp.payroll_start_date = None
        else:
            from app.modules.employee.joining_status import parse_joining_date

            emp.payroll_start_date = parse_joining_date(str(raw))

    if "timesheetRequired" in body:
        emp.timesheet_required = bool(body.get("timesheetRequired"))

    # leavePolicyId is applied asynchronously via leave.policy_assignment
    # (validate Active policy + create/recalc balances). Do not set FK here.

    apply_employment_classification(emp, body)


def profile_fields_to_dict(
    emp: Any,
    *,
    include_full_national_id: bool = False,
) -> dict[str, Any]:
    """Public EMP-1.1 fields for employee payloads (national ID last4 only)."""
    encrypted = getattr(emp, "national_id_number_encrypted", None)
    grade_band = getattr(emp, "grade_band", None) or getattr(emp, "job_rank", None)
    photo_url = getattr(emp, "avatar_object_key", None) or None
    official = emp.email_id
    status_val = str(getattr(emp, "status", "") or "")
    email_lower = str(official or "").strip().lower()
    if (
        status_val == "NEW"
        and email_lower.startswith("draft+")
        and email_lower.endswith("@hrms.local")
    ):
        official = None
    data: dict[str, Any] = {
        "officialEmail": official,
        "middleName": emp.middle_name,
        "gender": emp.gender,
        "maritalStatus": getattr(emp, "marital_status", None),
        "dateOfBirth": emp.date_of_birth,
        "phoneNumber": emp.phone_number,
        "alternatePhoneNumber": getattr(emp, "alternate_phone_number", None),
        "nationality": getattr(emp, "nationality", None),
        "ethnicity": getattr(emp, "ethnicity", None),
        "nationalIdCountry": getattr(emp, "national_id_country", None),
        "nationalIdDocumentType": getattr(emp, "national_id_document_type", None),
        "nationalIdLast4": getattr(emp, "national_id_last4", None),
        "nationalIdVerificationStatus": getattr(
            emp, "national_id_verification_status", None
        ),
        "hasNationalId": bool(encrypted),
        "employeeImmigrationStatus": getattr(
            emp, "employee_immigration_status", None
        ),
        "passportNumber": getattr(emp, "passport_number", None),
        "passportIssuingCountryAuthority": getattr(
            emp, "passport_issuing_country_authority", None
        ),
        "passportStartDate": getattr(emp, "passport_start_date", None),
        "passportExpirationDate": getattr(emp, "passport_expiration_date", None),
        "workMode": getattr(emp, "work_mode", None),
        "payrollStartDate": getattr(emp, "payroll_start_date", None),
        "timesheetRequired": bool(getattr(emp, "timesheet_required", False)),
        "leavePolicyId": (
            str(getattr(emp, "leave_policy_id"))
            if getattr(emp, "leave_policy_id", None)
            else None
        ),
        "leavePolicyEffectiveDate": (
            emp.leave_policy_effective_date.isoformat()
            if getattr(emp, "leave_policy_effective_date", None)
            else None
        ),
        "probationEndDate": getattr(emp, "probation_end_date", None),
        "gradeBand": grade_band,
        "assignedCountry": getattr(emp, "assigned_country", None),
        "photoUrl": photo_url,
    }
    data.update(classification_fields_from_employee(emp))
    if include_full_national_id and encrypted:
        data["nationalIdNumber"] = decrypt_field(encrypted)
    return data
