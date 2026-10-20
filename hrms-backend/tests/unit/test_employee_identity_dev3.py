"""Dev 3: create status from joining date; activate-due; business id helpers."""

from __future__ import annotations

from datetime import date
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.core.roles import Status
from app.modules.employee.employee_code import name_based_code_stem
from app.modules.employee.service import EmployeeService


def _create_body(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "firstName": "Ada",
        "lastName": "Lovelace",
        "emailId": "ada@example.com",
        "personalEmail": "ada.personal@example.com",
        "dateOfBirth": "1990-05-05",
        "phoneNumber": "+15550100100",
        "dateOfJoining": "2024-01-01",
        "leavePolicyId": str(uuid4()),
    }
    body.update(overrides)
    return body


def _session_no_email_collision() -> AsyncMock:
    session = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    empty = MagicMock()
    empty.scalar_one_or_none.return_value = None
    session.execute = AsyncMock(return_value=empty)
    return session


def test_name_based_code_stem() -> None:
    assert name_based_code_stem("Satya", "Hegde") == "SAT_HEG"


@pytest.mark.asyncio
async def test_create_past_joining_is_active() -> None:
    svc = EmployeeService()
    session = _session_no_email_collision()
    actor = {"firstName": "HR", "lastName": "Admin"}
    onboarding = MagicMock()
    onboarding.id = uuid4()
    onboarding.status = "IN_PROGRESS"

    with (
        patch(
            "app.modules.employee.service.ensure_onboarding_for_employee",
            AsyncMock(return_value=onboarding),
        ),
        patch.object(svc, "_assign_employee_code", AsyncMock(return_value="ADA_LOV")),
        patch.object(svc, "_apply_master_fields", AsyncMock()),
        patch.object(svc, "_ensure_business_employee_id", AsyncMock()),
        patch.object(svc, "_apply_profile_payload", AsyncMock()),
        patch.object(
            svc,
            "_to_dict",
            AsyncMock(return_value={"status": Status.ACTIVE.value, "employeeCode": "ADA_LOV"}),
        ),
        patch(
            "app.modules.employee.service.apply_profile_fields",
            MagicMock(),
        ),
        patch(
            "app.modules.employee.service.record_field_change",
            AsyncMock(return_value=0),
        ),
        patch(
            "app.modules.employee.service.hash_password",
            return_value="hashed",
        ),
        patch(
            "app.modules.employee.service.assign_or_change_leave_policy",
            AsyncMock(return_value=True),
        ),
        patch(
            "app.modules.employee.service.issue_and_send_invite",
            AsyncMock(),
        ),
    ):
        result = await svc.create(session, _create_body(dateOfJoining="2020-01-01"), actor)

    emp = session.add.call_args[0][0]
    assert emp.status == Status.ACTIVE.value
    assert emp.payroll_start_date == "2020-01-01"
    assert result["status"] == Status.ACTIVE.value


@pytest.mark.asyncio
async def test_create_future_joining_is_pending() -> None:
    svc = EmployeeService()
    session = _session_no_email_collision()
    actor = {"firstName": "HR", "lastName": "Admin"}
    onboarding = MagicMock()
    onboarding.id = uuid4()
    onboarding.status = "IN_PROGRESS"

    with (
        patch(
            "app.modules.employee.service.ensure_onboarding_for_employee",
            AsyncMock(return_value=onboarding),
        ),
        patch.object(svc, "_assign_employee_code", AsyncMock(return_value="ADA_LOV")),
        patch.object(svc, "_apply_master_fields", AsyncMock()),
        patch.object(svc, "_ensure_business_employee_id", AsyncMock()),
        patch.object(svc, "_apply_profile_payload", AsyncMock()),
        patch.object(
            svc,
            "_to_dict",
            AsyncMock(return_value={"status": Status.PENDING.value}),
        ),
        patch("app.modules.employee.service.apply_profile_fields", MagicMock()),
        patch(
            "app.modules.employee.service.record_field_change",
            AsyncMock(return_value=0),
        ),
        patch("app.modules.employee.service.hash_password", return_value="hashed"),
        patch(
            "app.modules.employee.service.assign_or_change_leave_policy",
            AsyncMock(return_value=True),
        ),
        patch(
            "app.modules.employee.service.issue_and_send_invite",
            AsyncMock(),
        ),
    ):
        await svc.create(session, _create_body(dateOfJoining="2099-06-01"), actor)

    emp = session.add.call_args[0][0]
    assert emp.status == Status.PENDING.value
    assert emp.business_employee_id is None


@pytest.mark.asyncio
async def test_activate_due_promotes_past_pending() -> None:
    svc = EmployeeService()
    session = AsyncMock()
    session.flush = AsyncMock()
    emp = MagicMock()
    emp.employee_id = uuid4()
    emp.status = Status.PENDING
    emp.employment_start_date = "2020-01-01"
    emp.payroll_start_date = None
    emp.business_employee_id = None
    result = MagicMock()
    result.scalars.return_value.all.return_value = [emp]
    session.execute = AsyncMock(return_value=result)

    with (
        patch("app.modules.employee.service.utc_today", return_value=date(2026, 8, 24)),
        patch.object(svc, "_ensure_business_employee_id", AsyncMock()),
        patch("app.modules.employee.service.record_field_change", AsyncMock()),
    ):
        out = await svc.activate_due(session)

    assert out["activatedCount"] == 1
    assert emp.status == Status.ACTIVE
    assert emp.payroll_start_date == "2020-01-01"
