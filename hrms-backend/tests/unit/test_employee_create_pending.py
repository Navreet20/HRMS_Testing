"""Create opens onboarding; status follows joining date (Dev 3); ACTIVE approve still gated."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.core.roles import Status
from app.modules.onboarding.enums import OnboardingStatus
from app.modules.employee.service import EmployeeService


def _create_body(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "firstName": "Ada",
        "lastName": "Lovelace",
        "emailId": "ada@example.com",
        "personalEmail": "ada.personal@example.com",
        "dateOfBirth": "1990-05-05",
        "phoneNumber": "+15550100100",
        "dateOfJoining": "2099-01-15",
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


def _stub_leave_and_invite(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.modules.employee.service.assign_or_change_leave_policy",
        AsyncMock(return_value=True),
    )
    monkeypatch.setattr(
        "app.modules.employee.service.issue_and_send_invite",
        AsyncMock(),
    )


@pytest.mark.asyncio
async def test_create_future_joining_pending_and_starts_onboarding(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    svc = EmployeeService()
    session = _session_no_email_collision()
    onboarding_id = uuid4()

    async def _code(*_a: Any, **_k: Any) -> str:
        return "ADA_LOV"

    async def _apply(*_a: Any, **_k: Any) -> None:
        return None

    async def _ensure_biz(*_a: Any, **_k: Any) -> None:
        return None

    async def _to_dict(_session: Any, emp: Any, **_k: Any) -> dict[str, Any]:
        return {"status": emp.status, "employeeCode": emp.employee_code}

    async def _ensure(*_a: Any, **_k: Any) -> MagicMock:
        return MagicMock(id=onboarding_id, status=OnboardingStatus.NOT_STARTED)

    monkeypatch.setattr(svc, "_assign_employee_code", _code)
    monkeypatch.setattr(svc, "_apply_master_fields", _apply)
    monkeypatch.setattr(svc, "_ensure_business_employee_id", _ensure_biz)
    monkeypatch.setattr(svc, "_to_dict", _to_dict)
    monkeypatch.setattr(svc, "_apply_profile_payload", AsyncMock())
    monkeypatch.setattr(
        "app.modules.employee.service.record_field_change",
        AsyncMock(return_value=0),
    )
    monkeypatch.setattr(
        "app.modules.employee.service.ensure_onboarding_for_employee",
        _ensure,
    )
    _stub_leave_and_invite(monkeypatch)

    result = await svc.create(
        session,
        _create_body(),
        {"firstName": "Pat", "lastName": "HR"},
    )

    assert result["status"] == Status.PENDING
    assert result["onboardingId"] == str(onboarding_id)
    emp = session.add.call_args[0][0]
    assert emp.status == Status.PENDING
    assert emp.employee_code == "ADA_LOV"


@pytest.mark.asyncio
async def test_create_ignores_active_status_in_body_when_joining_future(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    svc = EmployeeService()
    session = _session_no_email_collision()

    async def _code(*_a: Any, **_k: Any) -> str:
        return "GRA_HOP"

    async def _apply(*_a: Any, **_k: Any) -> None:
        return None

    async def _ensure_biz(*_a: Any, **_k: Any) -> None:
        return None

    async def _to_dict(_session: Any, emp: Any, **_k: Any) -> dict[str, Any]:
        return {"status": emp.status}

    async def _ensure(*_a: Any, **_k: Any) -> MagicMock:
        return MagicMock(id=uuid4(), status=OnboardingStatus.NOT_STARTED)

    monkeypatch.setattr(svc, "_assign_employee_code", _code)
    monkeypatch.setattr(svc, "_apply_master_fields", _apply)
    monkeypatch.setattr(svc, "_ensure_business_employee_id", _ensure_biz)
    monkeypatch.setattr(svc, "_to_dict", _to_dict)
    monkeypatch.setattr(svc, "_apply_profile_payload", AsyncMock())
    monkeypatch.setattr(
        "app.modules.employee.service.record_field_change",
        AsyncMock(return_value=0),
    )
    monkeypatch.setattr(
        "app.modules.employee.service.ensure_onboarding_for_employee",
        _ensure,
    )
    _stub_leave_and_invite(monkeypatch)

    result = await svc.create(
        session,
        _create_body(
            firstName="Grace",
            lastName="Hopper",
            emailId="grace@example.com",
            personalEmail="grace.personal@example.com",
            status=Status.ACTIVE,
            dateOfJoining="2099-06-01",
        ),
        {"firstName": "Pat", "lastName": "HR"},
    )

    assert result["status"] == Status.PENDING
    emp = session.add.call_args[0][0]
    assert emp.status == Status.PENDING


@pytest.mark.asyncio
async def test_approve_does_not_require_onboarding_completed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Onboarding ACTIVE gate is disabled while Onboarding is awaiting refinement."""
    svc = EmployeeService()
    session = AsyncMock()
    employee_id = uuid4()
    emp = MagicMock()
    emp.status = Status.PENDING
    emp.payroll_start_date = None
    emp.employment_start_date = "2026-01-01"
    emp.updated_date = None

    monkeypatch.setattr(svc, "_get", AsyncMock(return_value=emp))
    monkeypatch.setattr(
        svc, "_ensure_business_employee_id", AsyncMock(return_value=None)
    )
    monkeypatch.setattr(svc, "_to_dict", AsyncMock(return_value={"status": Status.ACTIVE}))
    monkeypatch.setattr(
        "app.modules.employee.service.record_field_change",
        AsyncMock(return_value=None),
    )

    result = await svc.approve(session, employee_id, actor={"firstName": "Pat"})

    assert emp.status == Status.ACTIVE
    assert result["status"] == Status.ACTIVE
