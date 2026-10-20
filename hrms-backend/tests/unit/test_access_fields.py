"""Unit tests for EMPLOYEE.DEPARTMENT / EMPLOYEE.ROLE dual-write helper."""

from __future__ import annotations

from app.core.roles import Role
from app.modules.employee.access_fields import (
    apply_synced_access_role_fields,
    force_create_access_role_employee,
    sync_access_role_fields,
)


def test_neither_sent_defaults_to_employee() -> None:
    assert sync_access_role_fields(None, None) == ("EMPLOYEE", "EMPLOYEE")
    assert sync_access_role_fields("", "") == ("EMPLOYEE", "EMPLOYEE")


def test_only_department_copies_to_role() -> None:
    assert sync_access_role_fields("HR", None) == ("HR", "HR")
    assert sync_access_role_fields("hr", "") == ("HR", "HR")


def test_only_role_copies_to_department() -> None:
    assert sync_access_role_fields(None, "ADMIN") == ("ADMIN", "ADMIN")
    assert sync_access_role_fields("", Role.ACCOUNTANT) == ("ACCOUNTANT", "ACCOUNTANT")


def test_both_matching_kept() -> None:
    assert sync_access_role_fields("HR", "HR") == ("HR", "HR")
    assert sync_access_role_fields("hr", "HR") == ("HR", "HR")


def test_conflict_prefers_valid_role() -> None:
    assert sync_access_role_fields("HR", "ADMIN") == ("ADMIN", "ADMIN")
    assert sync_access_role_fields("Engineering", "EMPLOYEE") == (
        "EMPLOYEE",
        "EMPLOYEE",
    )


def test_conflict_prefers_department_when_role_is_not_hrms_role() -> None:
    assert sync_access_role_fields("HR", "contractor") == ("HR", "HR")
    assert sync_access_role_fields("Engineering", "Staff") == (
        "Engineering",
        "Engineering",
    )


def test_apply_create_always_writes_both_keys() -> None:
    body: dict = {}
    apply_synced_access_role_fields(body)
    assert body["department"] == "EMPLOYEE"
    assert body["role"] == "EMPLOYEE"


def test_apply_patch_skips_when_neither_key_present() -> None:
    body = {"firstName": "Ada"}
    apply_synced_access_role_fields(body, only_if_present=True)
    assert "department" not in body
    assert "role" not in body


def test_apply_patch_copies_single_present_field() -> None:
    body = {"role": "HR"}
    apply_synced_access_role_fields(body, only_if_present=True)
    assert body["department"] == "HR"
    assert body["role"] == "HR"


def test_force_create_access_role_employee_ignores_client_role() -> None:
    body = {"department": "HR", "role": "ADMIN", "firstName": "Ada"}
    force_create_access_role_employee(body)
    assert body["department"] == "EMPLOYEE"
    assert body["role"] == "EMPLOYEE"
    assert body["firstName"] == "Ada"
