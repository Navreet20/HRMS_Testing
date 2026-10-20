"""Payroll-blocked listings exclude bootstrap/system logins."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.modules.onboarding.payroll_gate import list_blocked_from_payroll


@pytest.mark.asyncio
async def test_list_blocked_from_payroll_excludes_system_accounts() -> None:
    result = MagicMock()
    result.scalars.return_value.all.return_value = []
    session = AsyncMock()
    session.execute = AsyncMock(return_value=result)

    await list_blocked_from_payroll(session)

    executed = session.execute.await_args.args[0]
    sql = str(executed)
    assert "IS_SYSTEM_ACCOUNT" in sql.upper() or "is_system_account" in sql.lower()
