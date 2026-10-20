"""System-account exclusion from employee directory listings."""

from __future__ import annotations

import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.modules.employee.service import EmployeeService


def _emp(
    *,
    email: str,
    is_system: bool = False,
    status: str = "ACTIVE",
) -> MagicMock:
    row = MagicMock()
    row.employee_id = uuid.uuid4()
    row.email_id = email
    row.is_system_account = is_system
    row.status = status
    row.first_name = "Dev"
    row.last_name = "User"
    return row


@pytest.mark.asyncio
async def test_list_all_excludes_system_accounts(monkeypatch: pytest.MonkeyPatch) -> None:
    svc = EmployeeService()
    real = _emp(email="sri@example.com", is_system=False)
    system = _emp(email="developer@example.com", is_system=True)

    result = MagicMock()
    result.scalars.return_value.all.return_value = [real, system]
    session = AsyncMock()
    session.execute = AsyncMock(return_value=result)

    async def _to_dict(_session: Any, emp: Any, **_k: Any) -> dict:
        return {"emailId": emp.email_id, "isSystemAccount": emp.is_system_account}

    monkeypatch.setattr(svc, "_to_dict", _to_dict)
    monkeypatch.setattr(svc, "_pending_profile_change_ids", AsyncMock(return_value=set()))

    rows = await svc.list_all(session, {})
    # Filtering happens in SQL WHERE on the employee listing (first execute).
    executed = session.execute.await_args_list[0].args[0]
    sql = str(executed)
    assert "IS_SYSTEM_ACCOUNT" in sql.upper() or "is_system_account" in sql.lower()


@pytest.mark.asyncio
async def test_get_by_email_hides_system_account() -> None:
    svc = EmployeeService()
    system = _emp(email="dev@example.com", is_system=True)
    result = MagicMock()
    result.scalar_one_or_none.return_value = system
    session = AsyncMock()
    session.execute = AsyncMock(return_value=result)

    with pytest.raises(HTTPException) as exc:
        await svc.get_by_email(session, "dev@example.com")
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_patch_system_account_forbidden_for_non_self(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Non-self PATCH of a system account must 403 (router guard)."""
    from app.modules.employee import router as employee_router

    system_id = uuid.uuid4()
    system = _emp(email="developer@example.com", is_system=True)
    system.employee_id = system_id

    svc = MagicMock()
    svc._get = AsyncMock(return_value=system)
    monkeypatch.setattr(employee_router, "_svc", svc)

    session = AsyncMock()
    actor = {
        "employeeId": str(uuid.uuid4()),
        "role": "SUPERADMIN",
        "department": "SUPERADMIN",
    }

    with pytest.raises(HTTPException) as exc:
        await employee_router.update_employee(
            session,
            actor,
            system_id,
            {"firstName": "Hacked"},
        )
    assert exc.value.status_code == 403
    assert "System accounts" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_apply_master_fields_clears_reporting_manager(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    svc = EmployeeService()
    emp = MagicMock()
    emp.employee_id = uuid.uuid4()
    emp.reporting_manager_id = uuid.uuid4()
    emp.reports_to = str(emp.reporting_manager_id)
    emp.personal_email = None
    emp.department_id = None
    emp.location_id = None
    emp.designation_id = None
    emp.job_description = None
    emp.job_rank = None

    async def _ok(*_a: Any, **_k: Any) -> None:
        return None

    monkeypatch.setattr(svc, "_validate_org_fks", _ok)
    session = AsyncMock()
    await svc._apply_master_fields(
        session,
        emp,
        {"reportingManagerId": None},
    )
    assert emp.reporting_manager_id is None
    assert emp.reports_to is None
