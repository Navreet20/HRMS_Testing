"""Unit tests for employee access helpers (avatar self-service)."""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock

from app.modules.employee.access import actor_role, can_edit_employee, can_manage_avatar

TARGET_ID = uuid.uuid4()
OTHER_ID = uuid.uuid4()


def _emp(employee_id: uuid.UUID = TARGET_ID, role: str = "ADMIN") -> MagicMock:
    emp = MagicMock()
    emp.employee_id = employee_id
    emp.role = role
    emp.department = role
    return emp


def test_admin_without_edit_flags_cannot_edit_self() -> None:
    claims = {
        "employeeId": str(TARGET_ID),
        "department": "ADMIN",
        "role": "ADMIN",
        "editAccess": False,
        "fullAccess": False,
    }
    assert can_edit_employee(claims, _emp(), {}) is False


def test_admin_without_edit_flags_can_manage_own_avatar() -> None:
    claims = {
        "employeeId": str(TARGET_ID),
        "department": "ADMIN",
        "role": "ADMIN",
        "editAccess": False,
        "fullAccess": False,
        "viewAccess": False,
    }
    assert can_manage_avatar(claims, _emp(), {}) is True


def test_admin_without_edit_flags_cannot_manage_other_avatar() -> None:
    claims = {
        "employeeId": str(TARGET_ID),
        "department": "ADMIN",
        "role": "ADMIN",
        "editAccess": False,
        "fullAccess": False,
    }
    assert can_manage_avatar(claims, _emp(OTHER_ID), {}) is False


def test_employee_role_can_manage_own_avatar() -> None:
    claims = {
        "employeeId": str(TARGET_ID),
        "department": "EMPLOYEE",
        "role": "EMPLOYEE",
        "editAccess": False,
        "fullAccess": False,
    }
    assert can_manage_avatar(claims, _emp(role="EMPLOYEE"), {}) is True


def test_actor_role_prefers_valid_role_then_department() -> None:
    assert actor_role({"role": "HR", "department": "EMPLOYEE"}) == "HR"
    assert actor_role({"role": "", "department": "ADMIN"}) == "ADMIN"
    assert actor_role({"role": None, "department": "HR"}) == "HR"
    assert actor_role({"role": "not-a-role", "department": "ADMIN"}) == "ADMIN"
    assert actor_role({"role": "not-a-role"}) == "EMPLOYEE"
