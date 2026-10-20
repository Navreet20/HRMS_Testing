"""Canonical employee employment statuses (distinct from shared Status).

Employee records use Draft (NEW) / Pending / Active / Inactive only.
Legacy employment values map to Inactive. Other Status members (APPROVED,
REJECTED, ERROR, …) remain for documents, timesheets, and profile changes.
"""

from __future__ import annotations

from typing import Any

from app.core.roles import Status

EMPLOYEE_STATUSES = frozenset(
    {
        Status.NEW.value,
        Status.PENDING.value,
        Status.ACTIVE.value,
        Status.INACTIVE.value,
    }
)

EMPLOYEE_INACTIVE_ALIASES = frozenset(
    {
        Status.INACTIVE.value,
        Status.SUSPENDED.value,
        Status.EXITED.value,
        Status.REJECTED.value,
        Status.TERMINATED.value,
        Status.RESIGNED.value,
        Status.ERROR.value,
    }
)

_STATUS_ALIASES: dict[str, str] = {
    "NEW": Status.NEW.value,
    "DRAFT": Status.NEW.value,
    "PENDING": Status.PENDING.value,
    "ACTIVE": Status.ACTIVE.value,
    "INACTIVE": Status.INACTIVE.value,
    "SUSPENDED": Status.INACTIVE.value,
    "EXITED": Status.INACTIVE.value,
    "REJECTED": Status.INACTIVE.value,
    "TERMINATED": Status.INACTIVE.value,
    "RESIGNED": Status.INACTIVE.value,
    "ERROR": Status.INACTIVE.value,
}


def canonicalize_employee_status(value: Any) -> str | None:
    """Map a stored/API status onto the four employee values, or None if unknown."""
    raw = str(value or "").strip().upper().replace(" ", "_").replace("-", "_")
    if not raw:
        return None
    return _STATUS_ALIASES.get(raw)


def employee_status_for_api(value: Any) -> str:
    """Serialize EMPLOYEE.STATUS using the four-value model."""
    return canonicalize_employee_status(value) or Status.ACTIVE.value
