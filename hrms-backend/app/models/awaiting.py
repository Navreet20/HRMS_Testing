"""Import-time placeholders for legacy models that have NO table in the 37-table schema.

These are NOT SQLAlchemy models and never create a table. They exist only so old service code that still does
``from app.models.awaiting import Vendor`` imports cleanly. The first time a request actually *uses* one (calling it,
reading an attribute, passing it to ``select()``) it raises ``HTTPException(501)``, so a soft-disabled feature answers
"Awaiting Refinement" instead of crashing with a 500.

Replace a placeholder with a real model (and delete it from ``NAMES``) when its module is refined.
"""
from __future__ import annotations

from fastapi import HTTPException

DETAIL = "Awaiting Refinement: this feature is not wired to the new schema yet."


def _unavailable(name: str) -> HTTPException:
    return HTTPException(status_code=501, detail=f"{DETAIL} ({name})")


class _AwaitingMeta(type):
    def __call__(cls, *args, **kwargs):  # noqa: ANN002, ANN003
        raise _unavailable(cls.__name__)

    def __getattr__(cls, attr: str):
        # Introspection probes (copy, pickle, typing, sqlalchemy duck-typing) get a plain AttributeError.
        if attr.startswith("__") and attr != "__clause_element__":
            raise AttributeError(attr)
        raise _unavailable(cls.__name__)


def _make(name: str) -> type:
    return _AwaitingMeta(name, (), {"__module__": __name__, "__doc__": f"Placeholder (no table): {name}."})


NAMES: tuple[str, ...] = (
    # former compat_* stubs
    "AccessGrantAudit", "ApplicationConfig", "AssetActivityLog", "ClientIndustry",
    "ClientInvoicingEntity", "ClientStakeholder", "DepartmentConfig", "EmployeeDocument",
    "EmployeeFieldAudit", "EmployeeProfileChange", "EmployeeProjectData", "Expense", "ITRequest", "InAppNotification",
    "JobFamilyConfig", "LegacyUser", "NotificationOutbox", "NotificationTemplate", "Payroll",
    "ProjectClientStakeholder", "ScheduleEvent", "TimesheetDetails", "Vendor", "WorkflowEvent",
    # former UPPERCASE onboarding tables
    "DocumentType", "OnboardingTemplate", "OnboardingTemplateItem", "EmployeeOnboarding", "OnboardingChecklistItem",
    "ComplianceDocument", "EmployeeBankAccount", "BankVerificationAttempt", "OnboardingActivity",
    "EmployeeLeaveOpening", "SensitiveFieldAccessLog",
    # former UPPERCASE invoice tables
    "ClientInvoice", "VendorInvoice",
)

for _name in NAMES:
    globals()[_name] = _make(_name)
del _name

__all__ = list(NAMES)
