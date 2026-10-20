"""Default onboarding template and document types are optional for activation."""

from __future__ import annotations

from app.modules.onboarding.defaults import (
    DEFAULT_TEMPLATE_ITEMS,
    DEFAULT_WORK_AUTH_DOCUMENT_CODES,
    OPTIONAL_CHECKLIST_ITEM_TYPES,
    SEED_DOCUMENT_TYPES,
)


def test_seed_document_types_are_optional() -> None:
    assert {spec["code"] for spec in SEED_DOCUMENT_TYPES} >= {
        "PASSPORT",
        "I9",
        "WORK_AUTH",
        "SSN_CARD",
        "BANK_PROOF",
    }
    assert all(spec["is_mandatory"] is False for spec in SEED_DOCUMENT_TYPES)
    assert "BANK_PROOF" in DEFAULT_WORK_AUTH_DOCUMENT_CODES


def test_default_template_work_auth_and_payroll_are_optional() -> None:
    by_type = {str(spec["type"]): spec for spec in DEFAULT_TEMPLATE_ITEMS}
    assert by_type["DOCUMENT_GROUP"]["is_mandatory"] is False
    assert by_type["BANK_VERIFICATION"]["is_mandatory"] is False
    assert by_type["ACTIVATION"]["is_mandatory"] is True
    assert OPTIONAL_CHECKLIST_ITEM_TYPES == {"DOCUMENT_GROUP", "BANK_VERIFICATION"}
    codes = by_type["DOCUMENT_GROUP"]["config"]["document_type_codes"]
    assert "BANK_PROOF" in codes
    assert "PASSPORT" in codes
    assert "I9" in codes
    assert "WORK_AUTH" in codes
