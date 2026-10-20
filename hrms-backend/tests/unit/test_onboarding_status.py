"""Unit tests: onboarding status derivation."""

from __future__ import annotations

import pytest

from app.modules.onboarding.enums import (
    BankAccountStatus,
    ChecklistItemStatus,
    ChecklistItemType,
    OnboardingStatus,
)
from app.modules.onboarding.status import (
    ChecklistItemView,
    derive_onboarding_status,
)


def _item(
    *,
    id: str = "i1",
    type: str = ChecklistItemType.DOCUMENT_GROUP,
    label: str = "Work Authorization",
    mandatory: bool = True,
    status: str = ChecklistItemStatus.PENDING,
) -> ChecklistItemView:
    return ChecklistItemView(
        id=id, type=type, label=label, is_mandatory=mandatory, status=status
    )


def _standard_items(
    *,
    doc: str = ChecklistItemStatus.PENDING,
    bank: str = ChecklistItemStatus.PENDING,
    act: str = ChecklistItemStatus.PENDING,
    mandatory: bool = True,
) -> list[ChecklistItemView]:
    return [
        _item(
            id="doc",
            type=ChecklistItemType.DOCUMENT_GROUP,
            label="Work Authorization",
            mandatory=mandatory,
            status=doc,
        ),
        _item(
            id="bank",
            type=ChecklistItemType.BANK_VERIFICATION,
            label="Payroll Account",
            mandatory=mandatory,
            status=bank,
        ),
        _item(id="act", type=ChecklistItemType.ACTIVATION, label="Activate Employee", status=act),
    ]


@pytest.mark.parametrize(
    ("items", "bank_status", "current", "expected"),
    [
        (_standard_items(), None, OnboardingStatus.NOT_STARTED, OnboardingStatus.NOT_STARTED),
        (
            _standard_items(doc=ChecklistItemStatus.IN_REVIEW),
            BankAccountStatus.NOT_SUBMITTED,
            OnboardingStatus.NOT_STARTED,
            OnboardingStatus.IN_PROGRESS,
        ),
        (
            _standard_items(doc=ChecklistItemStatus.REJECTED),
            BankAccountStatus.SUBMITTED,
            OnboardingStatus.IN_PROGRESS,
            OnboardingStatus.BLOCKED,
        ),
        (
            _standard_items(doc=ChecklistItemStatus.APPROVED, bank=ChecklistItemStatus.APPROVED),
            BankAccountStatus.RE_VERIFICATION_REQUIRED,
            OnboardingStatus.IN_PROGRESS,
            OnboardingStatus.BLOCKED,
        ),
        (
            _standard_items(doc=ChecklistItemStatus.APPROVED, bank=ChecklistItemStatus.APPROVED),
            BankAccountStatus.VERIFIED,
            OnboardingStatus.IN_PROGRESS,
            OnboardingStatus.READY_TO_ACTIVATE,
        ),
        (
            _standard_items(
                doc=ChecklistItemStatus.APPROVED,
                bank=ChecklistItemStatus.APPROVED,
                act=ChecklistItemStatus.APPROVED,
            ),
            BankAccountStatus.VERIFIED,
            OnboardingStatus.COMPLETED,
            OnboardingStatus.COMPLETED,
        ),
        (
            _standard_items(doc=ChecklistItemStatus.APPROVED, bank=ChecklistItemStatus.APPROVED),
            BankAccountStatus.VERIFIED,
            OnboardingStatus.CANCELLED,
            OnboardingStatus.CANCELLED,
        ),
    ],
)
def test_derive_onboarding_status(items, bank_status, current, expected) -> None:
    assert (
        derive_onboarding_status(
            current_status=current, items=items, primary_bank_status=bank_status
        )
        == expected
    )


def test_ready_ignores_pending_activation_item() -> None:
    """Activation stays PENDING until POST /activate — must not block READY_TO_ACTIVATE."""
    items = _standard_items(
        doc=ChecklistItemStatus.APPROVED,
        bank=ChecklistItemStatus.APPROVED,
        act=ChecklistItemStatus.PENDING,
    )
    assert (
        derive_onboarding_status(
            current_status=OnboardingStatus.IN_PROGRESS,
            items=items,
            primary_bank_status=BankAccountStatus.VERIFIED,
        )
        == OnboardingStatus.READY_TO_ACTIVATE
    )


def test_optional_pending_items_are_ready_to_activate() -> None:
    items = _standard_items(mandatory=False)
    assert (
        derive_onboarding_status(
            current_status=OnboardingStatus.NOT_STARTED,
            items=items,
            primary_bank_status=None,
        )
        == OnboardingStatus.READY_TO_ACTIVATE
    )
