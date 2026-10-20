"""Unit tests for config-driven field permissions + national ID masking."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.modules.employee.access import can_view_full_national_id
from app.modules.employee.field_permissions import (
    assert_patch_fields_allowed,
    can_view_full_national_id_for_role,
    can_write,
    mask_last4,
)


def test_hr_can_view_full_national_id() -> None:
    claims = {"role": "HR", "employeeId": "other-id"}
    assert can_view_full_national_id(claims, "emp-1") is True
    assert can_view_full_national_id_for_role("HR", is_self=False) is True


def test_admin_can_view_full_national_id() -> None:
    claims = {"role": "ADMIN", "employeeId": "other-id"}
    assert can_view_full_national_id(claims, "emp-1") is True


def test_superadmin_can_view_full_national_id() -> None:
    claims = {"role": "SUPERADMIN", "employeeId": "other-id"}
    assert can_view_full_national_id(claims, "emp-1") is True


def test_employee_cannot_view_full_own_national_id() -> None:
    claims = {"role": "EMPLOYEE", "employeeId": "emp-1"}
    assert can_view_full_national_id(claims, "emp-1") is False
    assert can_view_full_national_id_for_role("EMPLOYEE", is_self=True) is False


def test_mask_last4() -> None:
    assert mask_last4("123-45-6789") == "••••6789"
    assert mask_last4("KDHFKDHFK") == "••••DHFK"
    assert mask_last4("") == ""


def test_self_can_write_personal_email_later() -> None:
    assert can_write("personalEmail", "EMPLOYEE", True, is_self=True) is True
    assert can_write("firstName", "EMPLOYEE", True, is_self=True) is False


def test_hr_can_edit_identity_and_personal_after_save() -> None:
    assert can_write("firstName", "HR", True, is_self=False) is True
    assert can_write("dateOfBirth", "HR", True, is_self=False) is True
    assert can_write("personalEmail", "HR", True, is_self=False) is True
    assert can_write("addressLine1", "HR", True, is_self=False) is True
    assert can_write("emergencyName", "HR", True, is_self=False) is True
    assert can_write("nationalIdNumber", "HR", True, is_self=False) is True
    assert can_write("nationalIdNumber", "ADMIN", True, is_self=False) is True


def test_self_cannot_write_nationality_after_hire() -> None:
    assert can_write("nationality", "EMPLOYEE", True, is_self=True) is False
    assert can_write("nationality", "HR", True, is_self=False) is True


def test_assert_patch_rejects_nationality_for_self() -> None:
    with pytest.raises(HTTPException) as exc:
        assert_patch_fields_allowed(
            {"nationality": "IN"},
            app_role="EMPLOYEE",
            is_self=True,
            already_saved=True,
        )
    assert exc.value.status_code == 403


def test_assert_patch_rejects_identity_for_self() -> None:
    with pytest.raises(HTTPException) as exc:
        assert_patch_fields_allowed(
            {"firstName": "Ada"},
            app_role="EMPLOYEE",
            is_self=True,
            already_saved=True,
        )
    assert exc.value.status_code == 403


def test_assert_patch_allows_self_onboarding_fields() -> None:
    assert_patch_fields_allowed(
        {"personalEmail": "a@b.com", "gender": "FEMALE"},
        app_role="EMPLOYEE",
        is_self=True,
        already_saved=True,
    )


def test_assert_patch_allows_hr_personal_fields_after_save() -> None:
    assert_patch_fields_allowed(
        {
            "firstName": "Ada",
            "lastName": "Lovelace",
            "personalEmail": "a@b.com",
            "phoneNumber": "+15550100",
            "gender": "FEMALE",
            "addressLine1": "1 Main St",
            "city": "Austin",
            "state": "TX",
            "postalCode": "78701",
            "country": "US",
            "emergencyName": "Bob",
            "emergencyPhone": "+15550101",
            "emergencyRelation": "Sibling",
        },
        app_role="HR",
        is_self=False,
        already_saved=True,
    )
