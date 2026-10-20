"""Unit tests for Workday-style employment classification mapping."""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.modules.employee.employment_classification import (
    EMPLOYMENT_TYPES,
    classification_fields_from_employee,
    derive_employment_type,
    normalize_employment_classification,
    parse_employment_type_to_ui,
)


@pytest.mark.parametrize(
    ("worker", "schedule", "category", "expected"),
    [
        ("EMPLOYEE", "FULL_TIME", "REGULAR", "FULL_TIME"),
        ("EMPLOYEE", "PART_TIME", "REGULAR", "PART_TIME"),
        ("EMPLOYEE", "FULL_TIME", "TEMPORARY", "TEMPORARY"),
        ("EMPLOYEE", "PART_TIME", "TEMPORARY", "TEMPORARY"),
        ("EMPLOYEE", "FULL_TIME", "INTERN", "INTERN"),
        ("EMPLOYEE", "PART_TIME", "UNPAID_INTERN", "UNPAID_INTERN"),
        ("CONTRACTOR", None, "C2C", "CONTRACTOR"),
        ("CONTRACTOR", None, "CONTRACT_1099", "CONTRACT_1099"),
    ],
)
def test_derive_employment_type(
    worker: str, schedule: str | None, category: str, expected: str
) -> None:
    assert (
        derive_employment_type(
            worker_type=worker,
            work_schedule=schedule,
            employment_category=category,
        )
        == expected
    )


@pytest.mark.parametrize(
    ("etype", "worker", "schedule", "category"),
    [
        ("FULL_TIME", "EMPLOYEE", "FULL_TIME", "REGULAR"),
        ("PART_TIME", "EMPLOYEE", "PART_TIME", "REGULAR"),
        ("TEMPORARY", "EMPLOYEE", "FULL_TIME", "TEMPORARY"),
        ("INTERN", "EMPLOYEE", "FULL_TIME", "INTERN"),
        ("UNPAID_INTERN", "EMPLOYEE", "FULL_TIME", "UNPAID_INTERN"),
        ("CONTRACTOR", "CONTRACTOR", None, "C2C"),
        ("CONTRACT_1099", "CONTRACTOR", None, "CONTRACT_1099"),
    ],
)
def test_parse_employment_type_to_ui(
    etype: str, worker: str, schedule: str | None, category: str
) -> None:
    assert parse_employment_type_to_ui(etype) == {
        "workerType": worker,
        "workSchedule": schedule,
        "employmentCategory": category,
    }


def test_normalize_from_classification_fields() -> None:
    body = {
        "workerType": "employee",
        "workSchedule": "part-time",
        "employmentCategory": "temporary",
    }
    normalize_employment_classification(body)
    assert body["employmentType"] == "TEMPORARY"
    assert body["workerType"] == "EMPLOYEE"
    assert body["workSchedule"] == "PART_TIME"
    assert body["employmentCategory"] == "TEMPORARY"


def test_normalize_contractor_clears_schedule() -> None:
    body = {
        "workerType": "CONTRACTOR",
        "workSchedule": "FULL_TIME",
        "employmentCategory": "C2C",
    }
    normalize_employment_classification(body)
    assert body["employmentType"] == "CONTRACTOR"
    assert body["workSchedule"] is None


def test_normalize_from_employment_type_only() -> None:
    body = {"employmentType": "contract_1099"}
    normalize_employment_classification(body)
    assert body["employmentType"] == "CONTRACT_1099"
    assert body["workerType"] == "CONTRACTOR"
    assert body["workSchedule"] is None
    assert body["employmentCategory"] == "CONTRACT_1099"


def test_normalize_rejects_invalid_category_for_worker() -> None:
    body = {
        "workerType": "EMPLOYEE",
        "workSchedule": "FULL_TIME",
        "employmentCategory": "C2C",
    }
    with pytest.raises(HTTPException) as exc:
        normalize_employment_classification(body)
    assert exc.value.status_code == 400


def test_allowlist_includes_temporary_and_unpaid() -> None:
    assert "TEMPORARY" in EMPLOYMENT_TYPES
    assert "UNPAID_INTERN" in EMPLOYMENT_TYPES


def test_classification_fields_from_employee_prefers_stored() -> None:
    emp = SimpleNamespace(
        worker_type="EMPLOYEE",
        work_schedule="PART_TIME",
        employment_category="REGULAR",
        employment_type="FULL_TIME",
    )
    assert classification_fields_from_employee(emp) == {
        "workerType": "EMPLOYEE",
        "workSchedule": "PART_TIME",
        "employmentCategory": "REGULAR",
    }


def test_classification_fields_from_employee_parses_legacy() -> None:
    emp = SimpleNamespace(
        worker_type=None,
        work_schedule=None,
        employment_category=None,
        employment_type="INTERN",
    )
    assert classification_fields_from_employee(emp) == {
        "workerType": "EMPLOYEE",
        "workSchedule": "FULL_TIME",
        "employmentCategory": "INTERN",
    }
