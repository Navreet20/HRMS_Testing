"""Pure onboarding status derivation (no DB I/O)."""

from __future__ import annotations

from dataclasses import dataclass

from app.modules.onboarding.enums import (
    BankAccountStatus,
    ChecklistItemStatus,
    ChecklistItemType,
    OnboardingStatus,
)

_TERMINAL = frozenset({OnboardingStatus.COMPLETED, OnboardingStatus.CANCELLED})

_BANK_BLOCKING = frozenset(
    {
        BankAccountStatus.RE_VERIFICATION_REQUIRED,
        BankAccountStatus.FAILED,
    }
)


@dataclass(frozen=True, slots=True)
class ChecklistItemView:
    id: str
    type: str
    label: str
    is_mandatory: bool
    status: str


def _pre_activation_mandatory(items: list[ChecklistItemView]) -> list[ChecklistItemView]:
    """Activation item is approved only by POST /activate — exclude from ready gate."""
    return [
        i
        for i in items
        if i.is_mandatory and i.type != ChecklistItemType.ACTIVATION
    ]


def derive_onboarding_status(
    *,
    current_status: str,
    items: list[ChecklistItemView],
    primary_bank_status: str | None,
) -> str:
    """Recompute parent status from children. Terminal statuses are sticky."""
    if current_status in _TERMINAL:
        return current_status

    gate_items = _pre_activation_mandatory(items)
    bank_item = next((i for i in items if i.type == ChecklistItemType.BANK_VERIFICATION), None)

    if any(i.status in {ChecklistItemStatus.REJECTED, ChecklistItemStatus.EXPIRED} for i in gate_items):
        return OnboardingStatus.BLOCKED

    if bank_item and bank_item.is_mandatory and primary_bank_status in _BANK_BLOCKING:
        return OnboardingStatus.BLOCKED

    # No mandatory pre-activation work (typical default hire) — HR can activate now.
    if not gate_items or all(i.status == ChecklistItemStatus.APPROVED for i in gate_items):
        if bank_item and bank_item.is_mandatory and primary_bank_status != BankAccountStatus.VERIFIED:
            if primary_bank_status in _BANK_BLOCKING or primary_bank_status is None:
                return OnboardingStatus.BLOCKED
            return OnboardingStatus.IN_PROGRESS
        return OnboardingStatus.READY_TO_ACTIVATE

    if any(i.status != ChecklistItemStatus.PENDING for i in items):
        return OnboardingStatus.IN_PROGRESS

    return OnboardingStatus.NOT_STARTED
