"""Unit tests for national ID view permissions."""

from __future__ import annotations

from app.modules.employee.access import can_view_full_national_id


def test_hr_can_view_full_national_id() -> None:
    claims = {"role": "HR", "employeeId": "other-id"}
    assert can_view_full_national_id(claims, "emp-1") is True


def test_admin_can_view_full_national_id() -> None:
    claims = {"role": "ADMIN", "employeeId": "other-id"}
    assert can_view_full_national_id(claims, "emp-1") is True


def test_employee_cannot_view_own_full_national_id() -> None:
    claims = {"role": "EMPLOYEE", "employeeId": "emp-1"}
    assert can_view_full_national_id(claims, "emp-1") is False


def test_employee_cannot_view_other_national_id() -> None:
    claims = {"role": "EMPLOYEE", "employeeId": "emp-1"}
    assert can_view_full_national_id(claims, "emp-2") is False
