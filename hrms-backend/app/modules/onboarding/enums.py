"""Onboarding domain enums. Status values are stored as strings on rows."""

from __future__ import annotations

from enum import StrEnum


class ChecklistItemType(StrEnum):
    DOCUMENT_GROUP = "DOCUMENT_GROUP"
    BANK_VERIFICATION = "BANK_VERIFICATION"
    ACTIVATION = "ACTIVATION"


class OnboardingAssigneeRole(StrEnum):
    """Who owns the checklist item — maps onto HrmsRole where possible."""

    HR = "HR"
    MANAGER = "MANAGER"
    EMPLOYEE = "EMPLOYEE"
    IT = "IT"


class OnboardingStatus(StrEnum):
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    BLOCKED = "BLOCKED"
    READY_TO_ACTIVATE = "READY_TO_ACTIVATE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class ChecklistItemStatus(StrEnum):
    PENDING = "PENDING"
    SUBMITTED = "SUBMITTED"
    IN_REVIEW = "IN_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"
    SKIPPED = "SKIPPED"


class DocumentCategory(StrEnum):
    IMMIGRATION = "IMMIGRATION"
    IDENTITY = "IDENTITY"
    EDUCATION = "EDUCATION"
    EMPLOYMENT = "EMPLOYMENT"
    TAX = "TAX"
    OTHER = "OTHER"


class ComplianceDocumentStatus(StrEnum):
    PENDING_REVIEW = "PENDING_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"
    SUPERSEDED = "SUPERSEDED"


class BankAccountStatus(StrEnum):
    NOT_SUBMITTED = "NOT_SUBMITTED"
    SUBMITTED = "SUBMITTED"
    VERIFICATION_PENDING = "VERIFICATION_PENDING"
    VERIFIED = "VERIFIED"
    FAILED = "FAILED"
    RE_VERIFICATION_REQUIRED = "RE_VERIFICATION_REQUIRED"


class BankVerificationMethod(StrEnum):
    MANUAL_DOCUMENT = "MANUAL_DOCUMENT"
    PENNY_DROP = "PENNY_DROP"
    API_LOOKUP = "API_LOOKUP"


class BankVerificationResult(StrEnum):
    PASS = "PASS"
    FAIL = "FAIL"
    PENDING = "PENDING"
