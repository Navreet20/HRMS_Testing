"""Unit tests for EMP-1.4 employment / assignment updates."""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.core.roles import Status
from app.modules.employee.employment_updates import (
    assert_can_apply_emp14,
    body_has_emp14_fields,
    build_audit_rows,
    normalize_emp14_status,
    snapshot_emp14,
)
from app.modules.employee.service import EmployeeService


def test_normalize_emp14_status_accepts_allowed_and_aliases() -> None:
    assert normalize_emp14_status("Active") == Status.ACTIVE
    assert normalize_emp14_status("SUSPENDED") == Status.INACTIVE
    assert normalize_emp14_status("exited") == Status.INACTIVE
    assert normalize_emp14_status("TERMINATED") == Status.INACTIVE
    assert normalize_emp14_status("INACTIVE") == Status.INACTIVE


def test_normalize_emp14_status_rejects_pending() -> None:
    with pytest.raises(HTTPException) as exc:
        normalize_emp14_status("PENDING")
    assert exc.value.status_code == 400


def test_assert_can_apply_emp14_rejects_employee() -> None:
    with pytest.raises(HTTPException) as exc:
        assert_can_apply_emp14({"role": "EMPLOYEE", "department": "EMPLOYEE"})
    assert exc.value.status_code == 403


def test_assert_can_apply_emp14_allows_hr() -> None:
    assert_can_apply_emp14({"role": "HR", "department": "HR"})


def test_body_has_emp14_fields() -> None:
    assert body_has_emp14_fields({"departmentId": "x"}) is True
    assert body_has_emp14_fields({"firstName": "Ada"}) is False


def test_build_audit_rows_diffs_only_changed_fields() -> None:
    emp_id = uuid.uuid4()
    before = {"status": "ACTIVE", "workMode": "REMOTE", "gradeBand": "L2"}
    after = {"status": "INACTIVE", "workMode": "REMOTE", "gradeBand": "L3"}
    rows = build_audit_rows(
        employee_id=emp_id,
        before=before,
        after=after,
        actor={"firstName": "Pat", "lastName": "HR", "employeeId": str(uuid.uuid4())},
        reason="probation extension",
    )
    fields = {r["field_name"] for r in rows}
    assert fields == {"status", "gradeBand"}
    status_row = next(r for r in rows if r["field_name"] == "status")
    assert status_row["old_value"] == "ACTIVE"
    assert status_row["new_value"] == "INACTIVE"
    assert status_row["changed_by"] == "Pat HR"
    assert status_row["reason"] == "probation extension"


def test_snapshot_emp14() -> None:
    emp = SimpleNamespace(
        department_id=uuid.uuid4(),
        designation_id=None,
        location_id=None,
        reporting_manager_id=None,
        employment_type="FULL_TIME",
        status="ACTIVE",
        grade_band="L2",
        probation_end_date="2026-12-31",
        work_mode="HYBRID",
        email_id="a@co.com",
        assigned_country="US",
    )
    snap = snapshot_emp14(emp)
    assert snap["officialEmail"] == "a@co.com"
    assert snap["workMode"] == "HYBRID"
    assert snap["departmentId"] == str(emp.department_id)


@pytest.mark.asyncio
async def test_circular_manager_rejected() -> None:
    svc = EmployeeService()
    a = uuid.uuid4()
    b = uuid.uuid4()
    session = AsyncMock()

    # Walk: B.manager -> A  ⇒ assigning A.manager = B is a cycle
    async def _execute(stmt: Any, *_a: Any, **_k: Any) -> MagicMock:
        result = MagicMock()
        # First call in _assert_no_manager_cycle: load B's manager → A
        # Second: load A's manager → None (or we only need one hop)
        sql = str(stmt)
        if "reporting_manager_id" in sql.lower() or True:
            # Always return A first, then None — simple two-step
            if not hasattr(_execute, "n"):
                _execute.n = 0  # type: ignore[attr-defined]
            _execute.n += 1  # type: ignore[attr-defined]
            if _execute.n == 1:  # type: ignore[attr-defined]
                result.scalar_one_or_none.return_value = a
            else:
                result.scalar_one_or_none.return_value = None
        return result

    session.execute = AsyncMock(side_effect=_execute)
    with pytest.raises(HTTPException) as exc:
        await svc._assert_no_manager_cycle(session, a, b)
    assert exc.value.status_code == 400
    assert "circular" in str(exc.value.detail).lower()


@pytest.mark.asyncio
async def test_validate_org_fks_rejects_self_manager() -> None:
    svc = EmployeeService()
    emp_id = uuid.uuid4()
    with pytest.raises(HTTPException) as exc:
        await svc._validate_org_fks(
            AsyncMock(),
            reporting_manager_id=emp_id,
            employee_id=emp_id,
            check_manager=True,
        )
    assert "self" in str(exc.value.detail).lower()
