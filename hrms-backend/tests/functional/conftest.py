"""Functional-test fixtures."""

from __future__ import annotations

import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.rbac import access as rbac_access
from tests.helpers.role_grants import clear_registry, grants_for, register_test_user


@pytest.fixture(autouse=True)
def role_based_session_grants(
    request: pytest.FixtureRequest, monkeypatch: pytest.MonkeyPatch
) -> Iterator[None]:
    """Resolve grants from the claims role when the request uses a mocked session.

    Real ``AsyncSession`` requests (live DB tests) keep reading grant rows.
    Module-level claims dicts are registered automatically; use
    ``register_test_user`` for claims built inside a test.
    """
    for value in vars(request.module).values():
        if isinstance(value, dict) and "employeeId" in value:
            register_test_user(value)

    real_resolve = rbac_access.resolve_session_grants

    async def _resolve(db: Any, *, employee_id: uuid.UUID) -> list[dict[str, Any]]:
        if isinstance(db, AsyncSession):
            return await real_resolve(db, employee_id=employee_id)
        return grants_for(employee_id)

    monkeypatch.setattr(rbac_access, "resolve_session_grants", _resolve)
    yield
    clear_registry()
