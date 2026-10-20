"""Allocation helpers must not lazy-load relationships on AsyncSession."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.modules.projects.schemas import AllocationWriteBody
from app.modules.projects.service import (
    _assert_allocation_dates_within_project,
    _assert_project_open_for_allocation,
    _employee_personal_address_fields,
    _existing_row_to_update,
    _project_effective_end,
)


def _project(
    planned_end: str | None, actual_end: str | None = None
) -> SimpleNamespace:
    return SimpleNamespace(
        project_startdate="2026-01-01",
        project_enddate=planned_end,
        actual_end_date=actual_end,
    )


def _days_from_today(days: int) -> str:
    return (datetime.utcnow().date() + timedelta(days=days)).isoformat()


def _allocation_body(**overrides: object) -> AllocationWriteBody:
    payload: dict[str, object] = {
        "employeeId": str(uuid.uuid4()),
        "roleOnProject": "Backend Engineer",
        "allocationPercentage": 50,
        "startDate": "2026-09-16",
        "billable": False,
    }
    payload.update(overrides)
    return AllocationWriteBody.model_validate(payload)


def test_personal_address_fields_accept_none_without_employee_relationship() -> None:
    address_id, label = _employee_personal_address_fields(None)
    assert address_id is None
    assert label is None


def test_personal_address_fields_use_preloaded_address() -> None:
    address_id = uuid.uuid4()
    address = SimpleNamespace(
        address_id=address_id,
        address_line1="26 Cabot Way",
        address_line2=None,
        city="Franklin Township",
        state="NJ",
        zip_code="08823",
        country="US",
    )
    found_id, label = _employee_personal_address_fields(address)
    assert found_id == str(address_id)
    assert "26 Cabot Way" in (label or "")
    assert "Franklin Township" in (label or "")


def test_allocation_write_rejects_blank_start_date() -> None:
    with pytest.raises(ValidationError) as exc:
        _allocation_body(startDate="")
    assert "startDate is required" in str(exc.value)


def test_allocation_write_accepts_work_and_client_locations() -> None:
    body = _allocation_body(
        clientLocationId="LOC00001",
        workLocationId="office-1",
        workLocationKind="office",
    )
    assert body.client_location_id == "LOC00001"
    assert body.work_location_id == "office-1"
    assert body.work_location_kind == "OFFICE"


def test_allocation_write_rejects_invalid_work_location_kind() -> None:
    with pytest.raises(ValidationError) as exc:
        _allocation_body(workLocationKind="HYBRID")
    assert "workLocationKind" in str(exc.value)


def test_existing_row_to_update_keeps_same_employee() -> None:
    allocation_id = uuid.uuid4()
    employee_id = uuid.uuid4()
    row = SimpleNamespace(allocation_id=allocation_id, employee_id=employee_id)
    item = _allocation_body(allocationId=str(allocation_id), employeeId=str(employee_id))
    assert _existing_row_to_update(item, {allocation_id: row}) is row


def test_existing_row_to_update_treats_employee_change_as_create() -> None:
    allocation_id = uuid.uuid4()
    row = SimpleNamespace(allocation_id=allocation_id, employee_id=uuid.uuid4())
    item = _allocation_body(allocationId=str(allocation_id), employeeId=str(uuid.uuid4()))
    assert _existing_row_to_update(item, {allocation_id: row}) is None


def test_effective_end_prefers_actual_end_date() -> None:
    assert _project_effective_end(_project("2026-09-30", "2026-10-31")) == "2026-10-31"
    assert _project_effective_end(_project("2026-09-30", None)) == "2026-09-30"
    assert _project_effective_end(_project(None, None)) is None


def test_allocation_end_may_extend_to_actual_end_date() -> None:
    _assert_allocation_dates_within_project(
        _project("2026-09-30", "2026-10-31"),
        start_date="2026-09-08",
        end_date="2026-10-31",
    )
    with pytest.raises(HTTPException):
        _assert_allocation_dates_within_project(
            _project("2026-09-30", "2026-10-31"),
            start_date="2026-09-08",
            end_date="2026-11-01",
        )


def test_allocation_blocked_when_planned_end_passed_without_actual_end() -> None:
    with pytest.raises(HTTPException) as exc:
        _assert_project_open_for_allocation(_project(_days_from_today(-1)))
    assert "Set an Actual End Date" in str(exc.value.detail)


def test_allocation_blocked_when_actual_end_passed() -> None:
    with pytest.raises(HTTPException) as exc:
        _assert_project_open_for_allocation(
            _project(_days_from_today(30), _days_from_today(-1))
        )
    assert "Update the Actual End Date" in str(exc.value.detail)


def test_allocation_allowed_when_actual_end_extends_past_planned_end() -> None:
    _assert_project_open_for_allocation(
        _project(_days_from_today(-5), _days_from_today(10))
    )
    _assert_project_open_for_allocation(_project(_days_from_today(0)))
    _assert_project_open_for_allocation(_project(None))
