"""Joining-date–driven employment status (Dev 3).

Create / activate-due: future joining → PENDING; today or past → ACTIVE.
Independent of onboarding checklist completion.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from fastapi import HTTPException

from app.core.roles import Status


def parse_joining_date(raw: Any) -> date | None:
    """Parse YYYY-MM-DD (or ISO datetime prefix). Empty → None."""
    if raw is None:
        return None
    text = str(raw).strip()
    if not text:
        return None
    day = text[:10]
    try:
        return date.fromisoformat(day)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail="Invalid dateOfJoining / employmentStartDate; expected YYYY-MM-DD",
        ) from exc


def resolve_joining_raw(body: dict[str, Any]) -> str | None:
    """Prefer dateOfJoining, then employmentStartDate, then startDate."""
    for key in ("dateOfJoining", "employmentStartDate", "startDate"):
        if key in body and body.get(key) is not None:
            text = str(body.get(key)).strip()
            if text:
                return text
    return None


def status_from_joining_date(
    joining: date | None,
    *,
    today: date | None = None,
) -> str:
    """Future joining → PENDING; missing/today/past → ACTIVE."""
    ref = today or date.today()
    if joining is None:
        return Status.ACTIVE.value
    if joining > ref:
        return Status.PENDING.value
    return Status.ACTIVE.value


def joining_iso_or_default(raw: str | None, *, default: str = "2024-01-01") -> str:
    """Normalize joining to YYYY-MM-DD string for storage."""
    if not raw or not str(raw).strip():
        return default
    parsed = parse_joining_date(raw)
    assert parsed is not None
    return parsed.isoformat()


def utc_today() -> date:
    return datetime.now(timezone.utc).date()


NON_PAYROLL_EMPLOYMENT_TYPES = frozenset({"UNPAID_INTERN"})


def resolve_payroll_start_date(
    *,
    joining_iso: str,
    payroll_raw: Any,
    employment_type: Any,
) -> str | None:
    """EMP-DATA-3: unpaid intern → None; else default to joining; never before joining."""
    etype = str(employment_type or "").strip().upper().replace("-", "_").replace(" ", "_")
    if etype in NON_PAYROLL_EMPLOYMENT_TYPES:
        return None
    if payroll_raw in (None, ""):
        return joining_iso
    payroll = joining_iso_or_default(str(payroll_raw).strip())
    if payroll < joining_iso:
        raise HTTPException(
            status_code=400,
            detail="payrollStartDate cannot be before dateOfJoining",
        )
    return payroll
