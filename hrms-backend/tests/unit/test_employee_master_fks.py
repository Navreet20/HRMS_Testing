"""Employee Master FK wiring: org masters + personal email + reporting manager."""

from __future__ import annotations

import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.modules.employee.service import EmployeeService

ADMIN_ID = uuid.uuid4()
MGR_ID = uuid.uuid4()
DEPT_ID = uuid.uuid4()


@pytest.mark.asyncio
async def test_create_rejects_missing_department() -> None:
    svc = EmployeeService()
    session = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    session.execute = AsyncMock(return_value=result)

    with pytest.raises(HTTPException) as exc:
        await svc._validate_org_fks(
            session, department_id=DEPT_ID, check_department=True
        )
    assert exc.value.status_code == 400
    assert "departmentId" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_reporting_manager_cannot_be_self() -> None:
    svc = EmployeeService()
    session = AsyncMock()
    with pytest.raises(HTTPException) as exc:
        await svc._validate_org_fks(
            session,
            reporting_manager_id=ADMIN_ID,
            employee_id=ADMIN_ID,
            check_manager=True,
        )
    assert exc.value.status_code == 400
    assert "self" in str(exc.value.detail).lower()


@pytest.mark.asyncio
async def test_apply_master_fields_sets_personal_email_and_manager(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    svc = EmployeeService()
    emp = MagicMock()
    emp.employee_id = ADMIN_ID
    emp.department_id = None
    emp.location_id = None
    emp.designation_id = None
    emp.reporting_manager_id = None
    emp.reports_to = None
    emp.personal_email = None
    emp.job_description = None
    emp.job_rank = None

    async def _ok(*_a: Any, **_k: Any) -> None:
        return None

    monkeypatch.setattr(svc, "_validate_org_fks", _ok)
    session = AsyncMock()
    await svc._apply_master_fields(
        session,
        emp,
        {
            "personalEmail": "me@personal.test",
            "reportingManagerId": str(MGR_ID),
        },
    )
    assert emp.personal_email == "me@personal.test"
    assert emp.reporting_manager_id == MGR_ID
    assert emp.reports_to == str(MGR_ID)


@pytest.mark.asyncio
async def test_create_rejects_inactive_department() -> None:
    svc = EmployeeService()
    session = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = "Inactive"
    session.execute = AsyncMock(return_value=result)

    with pytest.raises(HTTPException) as exc:
        await svc._validate_org_fks(
            session, department_id=DEPT_ID, check_department=True
        )
    assert exc.value.status_code == 400
    assert "not Active" in str(exc.value.detail)
