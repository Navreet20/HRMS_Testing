"""Default document types and checklist template for onboarding seed."""

from __future__ import annotations

from typing import Any

DEFAULT_MIME_TYPES: list[str] = [
    "application/pdf",
    "image/jpeg",
    "image/png",
]

# US-focused immigration / employment set (confirmed).
# Default hire docs are optional so HR can activate without uploads.
SEED_DOCUMENT_TYPES: list[dict[str, Any]] = [
    {
        "code": "PASSPORT",
        "name": "Passport",
        "category": "IMMIGRATION",
        "is_mandatory": False,
        "requires_expiry": True,
        "requires_document_number": True,
        "requires_issuing_country": True,
    },
    {
        "code": "I9",
        "name": "Form I-9",
        "category": "EMPLOYMENT",
        "is_mandatory": False,
        "requires_expiry": False,
        "requires_document_number": False,
        "requires_issuing_country": False,
    },
    {
        "code": "WORK_AUTH",
        "name": "Work authorization (EAD / I-797 / visa)",
        "category": "IMMIGRATION",
        "is_mandatory": False,
        "requires_expiry": True,
        "requires_document_number": True,
        "requires_issuing_country": False,
    },
    {
        "code": "SSN_CARD",
        "name": "Social Security card",
        "category": "IDENTITY",
        "is_mandatory": False,
        "requires_expiry": False,
        "requires_document_number": True,
        "requires_issuing_country": False,
    },
    {
        "code": "BANK_PROOF",
        "name": "Cancelled cheque or bank statement",
        "category": "OTHER",
        "is_mandatory": False,
        "requires_expiry": False,
        "requires_document_number": False,
        "requires_issuing_country": False,
    },
]

DEFAULT_WORK_AUTH_DOCUMENT_CODES: list[str] = [
    spec["code"] for spec in SEED_DOCUMENT_TYPES
]

# Work Authorization + Payroll Account stay on the checklist but never block
# activation. Activate Employee remains the HR action (excluded from blockers).
DEFAULT_TEMPLATE_ITEMS: list[dict[str, Any]] = [
    {
        "sequence": 1,
        "type": "DOCUMENT_GROUP",
        "label": "Work Authorization",
        "assigned_role": "EMPLOYEE",
        "sla_days": 14,
        "is_mandatory": False,
        "config": {"document_type_codes": list(DEFAULT_WORK_AUTH_DOCUMENT_CODES)},
    },
    {
        "sequence": 2,
        "type": "BANK_VERIFICATION",
        "label": "Payroll Account",
        "assigned_role": "EMPLOYEE",
        "sla_days": 7,
        "is_mandatory": False,
        "config": {"methods": ["MANUAL_DOCUMENT"], "require_proof": True},
    },
    {
        "sequence": 3,
        "type": "ACTIVATION",
        "label": "Activate Employee",
        "assigned_role": "HR",
        "sla_days": None,
        "is_mandatory": True,
        "config": {},
    },
]

OPTIONAL_CHECKLIST_ITEM_TYPES: frozenset[str] = frozenset(
    {"DOCUMENT_GROUP", "BANK_VERIFICATION"}
)

DEFAULT_TEMPLATE_NAME = "Standard hire"
