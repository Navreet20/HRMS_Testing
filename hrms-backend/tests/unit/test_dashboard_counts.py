"""Dashboard people counts exclude bootstrap/system logins."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.modules.dashboard.service import dashboard_data


@pytest.mark.asyncio
async def test_dashboard_active_employees_excludes_system_accounts() -> None:
    session = AsyncMock()
    # total employees, active employees, then company/customer/vendor/project pairs,
    # then legacy timesheets / pending timesheets / pending leaves / expenses
    session.scalar = AsyncMock(
        side_effect=[12, 9, 1, 1, 5, 4, 3, 3, 7, 6, 20, 2, 4, 8]
    )

    payload = await dashboard_data(session)

    employee_count_stmt = session.scalar.await_args_list[1].args[0]
    sql = str(employee_count_stmt)
    assert "IS_SYSTEM_ACCOUNT" in sql.upper() or "is_system_account" in sql.lower()
    assert payload["employee"] == {"total": 12, "active": 9}
    assert payload["activeEmployees"] == 9
    assert payload["company"] == {"total": 1, "active": 1}
    assert payload["project"] == {"total": 7, "active": 6}
    assert payload["timesheets"] == 20
    assert payload["pendingTimesheets"] == 2
    assert payload["leaveApplications"] == 4
    assert payload["projects"] == 7
    assert payload["expenses"] == 8


@pytest.mark.asyncio
async def test_dashboard_payload_has_fe_metric_shape() -> None:
    session = AsyncMock()
    session.scalar = AsyncMock(return_value=0)

    payload = await dashboard_data(session)

    for key in ("company", "employee", "customer", "vendor", "project"):
        assert set(payload[key].keys()) == {"total", "active"}
