"""Unit tests for Dev 3 joining-date status helpers."""

from __future__ import annotations

from datetime import date

import pytest
from fastapi import HTTPException

from app.core.roles import Status
from app.modules.employee.joining_status import (
    resolve_joining_raw,
    resolve_payroll_start_date,
    status_from_joining_date,
)


def test_future_joining_is_pending() -> None:
    assert (
        status_from_joining_date(date(2099, 1, 1), today=date(2026, 8, 24))
        == Status.PENDING.value
    )


def test_today_or_past_joining_is_active() -> None:
    today = date(2026, 8, 24)
    assert status_from_joining_date(today, today=today) == Status.ACTIVE.value
    assert status_from_joining_date(date(2020, 1, 1), today=today) == Status.ACTIVE.value


def test_resolve_joining_prefers_date_of_joining() -> None:
    body = {
        "dateOfJoining": "2026-09-01",
        "employmentStartDate": "2026-01-01",
        "startDate": "2025-01-01",
    }
    assert resolve_joining_raw(body) == "2026-09-01"


def test_payroll_defaults_to_joining_and_rejects_earlier_date() -> None:
    assert (
        resolve_payroll_start_date(
            joining_iso="2026-09-01",
            payroll_raw=None,
            employment_type="FULL_TIME",
        )
        == "2026-09-01"
    )
    assert (
        resolve_payroll_start_date(
            joining_iso="2026-09-01",
            payroll_raw="2026-09-15",
            employment_type="FULL_TIME",
        )
        == "2026-09-15"
    )
    with pytest.raises(HTTPException) as exc:
        resolve_payroll_start_date(
            joining_iso="2026-09-01",
            payroll_raw="2026-08-01",
            employment_type="FULL_TIME",
        )
    assert exc.value.status_code == 400
    assert "payrollStartDate" in str(exc.value.detail)


def test_unpaid_intern_payroll_is_not_applicable() -> None:
    assert (
        resolve_payroll_start_date(
            joining_iso="2026-09-01",
            payroll_raw="2026-09-01",
            employment_type="INTERN",
        )
        == "2026-09-01"
    )
    assert (
        resolve_payroll_start_date(
            joining_iso="2026-09-01",
            payroll_raw="2026-09-15",
            employment_type="INTERN",
        )
        == "2026-09-15"
    )
    assert (
        resolve_payroll_start_date(
            joining_iso="2026-09-01",
            payroll_raw="2026-09-01",
            employment_type="UNPAID_INTERN",
        )
        is None
    )
