"""Unit tests for profile field audit helpers."""

from __future__ import annotations

import uuid
from types import SimpleNamespace

from app.modules.employee.employment_updates import build_audit_rows
from app.modules.employee.profile_audit import snapshot_employee_scalars


def test_build_audit_rows_includes_changed_by_role() -> None:
    emp_id = uuid.uuid4()
    rows = build_audit_rows(
        employee_id=emp_id,
        before={"phoneNumber": "111"},
        after={"phoneNumber": "222"},
        actor={
            "firstName": "Pat",
            "lastName": "HR",
            "employeeId": str(uuid.uuid4()),
            "role": "HR",
            "department": "HR",
        },
        reason=None,
    )
    assert len(rows) == 1
    assert rows[0]["field_name"] == "phoneNumber"
    assert rows[0]["old_value"] == "111"
    assert rows[0]["new_value"] == "222"
    assert rows[0]["changed_by"] == "Pat HR"
    assert rows[0]["changed_by_role"] == "HR"


def test_build_audit_rows_skips_unchanged() -> None:
    emp_id = uuid.uuid4()
    rows = build_audit_rows(
        employee_id=emp_id,
        before={"city": "Austin", "state": "TX"},
        after={"city": "Austin", "state": "TX"},
        actor={"role": "EMPLOYEE", "department": "EMPLOYEE"},
    )
    assert rows == []


def test_snapshot_employee_scalars_covers_profile_and_photo() -> None:
    emp = SimpleNamespace(
        department_id=None,
        designation_id=None,
        location_id=None,
        reporting_manager_id=None,
        employment_type="FULL_TIME",
        status="ACTIVE",
        grade_band="L2",
        probation_end_date=None,
        work_mode="HYBRID",
        email_id="a@co.com",
        assigned_country="US",
        first_name="Ada",
        middle_name=None,
        last_name="Lovelace",
        date_of_birth="1990-01-01",
        gender="FEMALE",
        marital_status=None,
        ethnicity=None,
        nationality="US",
        phone_number="555",
        alternate_phone_number=None,
        personal_email="ada@ex.com",
        job_description="Engineer",
        job_rank=None,
        role="EMPLOYEE",
        national_id_country=None,
        national_id_document_type=None,
        national_id_last4=None,
        employment_start_date="2026-01-01",
        payroll_start_date="2026-01-01",
        avatar_object_key="employees/x/avatar/y.jpg",
    )
    snap = snapshot_employee_scalars(emp)
    assert snap["firstName"] == "Ada"
    assert snap["personalEmail"] == "ada@ex.com"
    assert snap["officialEmail"] == "a@co.com"
    assert snap["photoUrl"] == "set"
