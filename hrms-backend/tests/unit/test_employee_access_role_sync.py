"""Create / PATCH / CSV import keep EMPLOYEE.DEPARTMENT and EMPLOYEE.ROLE in sync."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.modules.employee.service import EmployeeService
from app.modules.onboarding.enums import OnboardingStatus


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


async def _stub_create_deps(svc: EmployeeService, monkeypatch: pytest.MonkeyPatch) -> None:
    async def _code(*_a: Any, **_k: Any) -> str:
        return "ADA_LOV"

    async def _apply(*_a: Any, **_k: Any) -> None:
        return None

    async def _ensure_biz(*_a: Any, **_k: Any) -> None:
        return None

    async def _to_dict(_session: Any, emp: Any, **_k: Any) -> dict[str, Any]:
        return {
            "department": emp.department,
            "role": emp.role,
            "employeeCode": emp.employee_code,
        }

    async def _ensure(*_a: Any, **_k: Any) -> MagicMock:
        return MagicMock(id=uuid4(), status=OnboardingStatus.NOT_STARTED)

    monkeypatch.setattr(svc, "_assign_employee_code", _code)
    monkeypatch.setattr(svc, "_apply_master_fields", _apply)
    monkeypatch.setattr(svc, "_ensure_business_employee_id", _ensure_biz)
    monkeypatch.setattr(svc, "_to_dict", _to_dict)
    # create() applies contact payload + audit after flush; unit tests use a
    # session mock that cannot satisfy _get / _employee_labels queries.
    monkeypatch.setattr(svc, "_apply_profile_payload", AsyncMock())
    monkeypatch.setattr(
        "app.modules.employee.service.record_field_change",
        AsyncMock(return_value=0),
    )
    monkeypatch.setattr(
        "app.modules.employee.service.ensure_onboarding_for_employee",
        _ensure,
    )
    monkeypatch.setattr(
        "app.modules.employee.service.assign_or_change_leave_policy",
        AsyncMock(return_value=True),
    )
    monkeypatch.setattr(
        "app.modules.employee.service.issue_and_send_invite",
        AsyncMock(),
    )


@pytest.mark.asyncio
async def test_create_only_department_forces_employee(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    svc = EmployeeService()
    session = _session_no_email_collision()
    await _stub_create_deps(svc, monkeypatch)

    await svc.create(
        session,
        _create_body(department="HR"),
        {"firstName": "Pat", "lastName": "HR"},
    )

    emp = session.add.call_args[0][0]
    assert emp.department == "EMPLOYEE"
    assert emp.role == "EMPLOYEE"


@pytest.mark.asyncio
async def test_create_only_role_forces_employee(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    svc = EmployeeService()
    session = _session_no_email_collision()
    await _stub_create_deps(svc, monkeypatch)

    await svc.create(
        session,
        _create_body(role="ADMIN"),
        {"firstName": "Pat", "lastName": "HR"},
    )

    emp = session.add.call_args[0][0]
    assert emp.department == "EMPLOYEE"
    assert emp.role == "EMPLOYEE"


@pytest.mark.asyncio
async def test_create_neither_defaults_employee(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    svc = EmployeeService()
    session = _session_no_email_collision()
    await _stub_create_deps(svc, monkeypatch)

    await svc.create(
        session,
        _create_body(),
        {"firstName": "Pat", "lastName": "HR"},
    )

    emp = session.add.call_args[0][0]
    assert emp.department == "EMPLOYEE"
    assert emp.role == "EMPLOYEE"


@pytest.mark.asyncio
async def test_create_both_matching_still_forces_employee(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    svc = EmployeeService()
    session = _session_no_email_collision()
    await _stub_create_deps(svc, monkeypatch)

    await svc.create(
        session,
        _create_body(department="ACCOUNTANT", role="ACCOUNTANT"),
        {"firstName": "Pat", "lastName": "HR"},
    )

    emp = session.add.call_args[0][0]
    assert emp.department == "EMPLOYEE"
    assert emp.role == "EMPLOYEE"


@pytest.mark.asyncio
async def test_create_conflict_still_forces_employee(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    svc = EmployeeService()
    session = _session_no_email_collision()
    await _stub_create_deps(svc, monkeypatch)

    await svc.create(
        session,
        _create_body(department="HR", role="ADMIN"),
        {"firstName": "Pat", "lastName": "HR"},
    )

    emp = session.add.call_args[0][0]
    assert emp.department == "EMPLOYEE"
    assert emp.role == "EMPLOYEE"


@pytest.mark.asyncio
async def test_patch_changing_department_updates_role(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    svc = EmployeeService()
    session = AsyncMock()
    session.flush = AsyncMock()
    emp = SimpleNamespace(
        department="EMPLOYEE",
        role="EMPLOYEE",
        email_id="ada@example.com",
        updated_date=None,
    )

    async def _get(*_a: Any, **_k: Any) -> SimpleNamespace:
        return emp

    async def _apply(*_a: Any, **_k: Any) -> None:
        return None

    async def _to_dict(_session: Any, row: Any, **_k: Any) -> dict[str, Any]:
        return {"department": row.department, "role": row.role}

    monkeypatch.setattr(svc, "_get", _get)
    monkeypatch.setattr(svc, "_apply_master_fields", _apply)
    monkeypatch.setattr(svc, "_to_dict", _to_dict)

    result = await svc.update(session, uuid4(), {"department": "HR"})
    assert emp.department == "HR"
    assert emp.role == "HR"
    assert result["department"] == "HR"
    assert result["role"] == "HR"


@pytest.mark.asyncio
async def test_patch_changing_role_updates_department(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    svc = EmployeeService()
    session = AsyncMock()
    session.flush = AsyncMock()
    emp = SimpleNamespace(
        department="EMPLOYEE",
        role="EMPLOYEE",
        email_id="ada@example.com",
        updated_date=None,
    )

    async def _get(*_a: Any, **_k: Any) -> SimpleNamespace:
        return emp

    async def _apply(*_a: Any, **_k: Any) -> None:
        return None

    async def _to_dict(_session: Any, row: Any, **_k: Any) -> dict[str, Any]:
        return {"department": row.department, "role": row.role}

    monkeypatch.setattr(svc, "_get", _get)
    monkeypatch.setattr(svc, "_apply_master_fields", _apply)
    monkeypatch.setattr(svc, "_to_dict", _to_dict)

    result = await svc.update(session, uuid4(), {"role": "ADMIN"})
    assert emp.department == "ADMIN"
    assert emp.role == "ADMIN"
    assert result["department"] == result["role"] == "ADMIN"


@pytest.mark.asyncio
async def test_import_only_department_does_not_default_conflicting_role(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    svc = EmployeeService()
    session = _session_no_email_collision()
    captured: list[dict[str, Any]] = []

    async def _create(_session: Any, body: dict[str, Any], _actor: dict, **_kw: Any) -> dict[str, Any]:
        captured.append(body)
        return {"ok": True}

    monkeypatch.setattr(svc, "create", _create)

    await svc.import_rows(
        session,
        [
            {
                "firstName": "Ada",
                "lastName": "Lovelace",
                "emailId": "ada-import@example.com",
                "department": "HR",
            }
        ],
        {"firstName": "Pat", "lastName": "HR"},
    )

    assert len(captured) == 1
    assert captured[0]["department"] == "HR"
    assert captured[0]["role"] in (None, "")


@pytest.mark.asyncio
async def test_import_create_forces_employee_despite_csv_department(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    svc = EmployeeService()
    session = _session_no_email_collision()
    await _stub_create_deps(svc, monkeypatch)

    await svc.import_rows(
        session,
        [
            {
                "firstName": "Ada",
                "lastName": "Lovelace",
                "emailId": "ada-import@example.com",
                "department": "HR",
                "leavePolicyId": str(uuid4()),
            }
        ],
        {"firstName": "Pat", "lastName": "HR"},
    )

    emp = session.add.call_args[0][0]
    assert emp.department == "EMPLOYEE"
    assert emp.role == "EMPLOYEE"


@pytest.mark.asyncio
async def test_import_conflicting_csv_still_forces_employee(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    svc = EmployeeService()
    session = _session_no_email_collision()
    await _stub_create_deps(svc, monkeypatch)

    await svc.import_rows(
        session,
        [
            {
                "firstName": "Ada",
                "lastName": "Lovelace",
                "emailId": "ada-import@example.com",
                "department": "Engineering",
                "role": "EMPLOYEE",
                "leavePolicyId": str(uuid4()),
            }
        ],
        {"firstName": "Pat", "lastName": "HR"},
    )

    emp = session.add.call_args[0][0]
    assert emp.department == "EMPLOYEE"
    assert emp.role == "EMPLOYEE"


@pytest.mark.asyncio
async def test_update_access_role_only_updates_department(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    svc = EmployeeService()
    session = AsyncMock()
    session.flush = AsyncMock()
    empty = MagicMock()
    empty.scalar_one_or_none.return_value = None
    session.execute = AsyncMock(return_value=empty)
    emp = SimpleNamespace(
        department="EMPLOYEE",
        role="EMPLOYEE",
        email_id="ada@example.com",
        employee_id=uuid4(),
    )

    async def _get(*_a: Any, **_k: Any) -> SimpleNamespace:
        return emp

    async def _apply(*_a: Any, **_k: Any) -> None:
        return None

    monkeypatch.setattr(svc, "_get", _get)
    monkeypatch.setattr(svc, "_apply_master_fields", _apply)
    monkeypatch.setattr(
        "app.modules.employee.service.employee_to_dict",
        lambda row: {"department": row.department, "role": row.role},
    )

    result = await svc.update_access(session, emp.employee_id, {"role": "HR"})
    assert emp.department == "HR"
    assert emp.role == "HR"
    assert result["department"] == "HR"
    assert result["role"] == "HR"
