"""RBAC-DATA-9: ACCESS_GRANT_AUDIT on grant create/update/revoke."""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tables import (EmployeeAccessGrant)
from app.models.awaiting import (AccessGrantAudit)
from app.modules.rbac.access import require_audit_trail_access
from app.modules.rbac.grant_audit import (
    AUDIT_ACTION_CREATED,
    AUDIT_ACTION_REVOKED,
    AUDIT_ACTION_UPDATED,
    FIELD_NAME_ACCESS_GRANT,
    grant_audit_to_trail_dict,
    record_grant_audit,
)
from app.modules.rbac.grants import (
    ACCESS_LEVEL_FULL_ACCESS,
    ACCESS_LEVEL_READ_ONLY,
    GRANT_STATUS_ACTIVE,
    revoke_grant,
    update_grant_access_level,
    upsert_employee_grants,
)
from app.modules.rbac.service import MASTER_STATUS_ACTIVE


def test_grant_audit_to_trail_dict_maps_created() -> None:
    row = SimpleNamespace(
        id=uuid.uuid4(),
        target_employee_id=uuid.uuid4(),
        target_employee_code="ADA-001",
        target_business_employee_id="EMP1",
        target_employee_name="Ada Lovelace",
        action=AUDIT_ACTION_CREATED,
        module_name="Clients",
        submodule_name=None,
        access_level=ACCESS_LEVEL_FULL_ACCESS,
        previous_access_level=None,
        actor_name="Pat Admin",
        actor_employee_id=uuid.uuid4(),
        actor_role="SUPERADMIN",
        occurred_at=None,
    )
    item = grant_audit_to_trail_dict(row)  # type: ignore[arg-type]
    assert item["fieldName"] == FIELD_NAME_ACCESS_GRANT
    assert item["oldValue"] is None
    assert item["newValue"] == "Clients · full_access (granted)"
    assert item["employeeName"] == "Ada Lovelace"


def test_grant_audit_to_trail_dict_maps_revoked() -> None:
    row = SimpleNamespace(
        id=uuid.uuid4(),
        target_employee_id=uuid.uuid4(),
        target_employee_code=None,
        target_business_employee_id=None,
        target_employee_name="Ada",
        action=AUDIT_ACTION_REVOKED,
        module_name="Clients",
        submodule_name=None,
        access_level=ACCESS_LEVEL_READ_ONLY,
        previous_access_level=ACCESS_LEVEL_READ_ONLY,
        actor_name="Pat",
        actor_employee_id=None,
        actor_role="ADMIN",
        occurred_at=None,
    )
    item = grant_audit_to_trail_dict(row)  # type: ignore[arg-type]
    assert item["oldValue"] == "Clients · read_only"
    assert item["newValue"] == "Revoked"


@pytest.mark.asyncio
async def test_upsert_records_created_audit() -> None:
    employee_id = uuid.uuid4()
    module = SimpleNamespace(
        module_id=3,
        module_name="Clients",
        has_submodules=False,
        status=MASTER_STATUS_ACTIVE,
        submodules=[],
    )
    emp = SimpleNamespace(
        employee_id=employee_id,
        first_name="Ada",
        last_name="Lovelace",
        employee_code="ADA-001",
        business_employee_id="EMP1",
    )
    emp_result = MagicMock()
    emp_result.scalar_one_or_none.return_value = emp
    mod_result = MagicMock()
    mod_result.scalar_one_or_none.return_value = module
    existing_result = MagicMock()
    existing_result.scalars.return_value.first.return_value = None

    audited: list[AccessGrantAudit] = []

    def add(obj: object) -> None:
        if isinstance(obj, AccessGrantAudit):
            audited.append(obj)

    session = AsyncMock(spec=AsyncSession)
    session.add = add
    session.flush = AsyncMock()
    session.execute = AsyncMock(
        side_effect=[emp_result, mod_result, existing_result]
    )

    await upsert_employee_grants(
        session,
        employee_id=employee_id,
        payload={"moduleId": 3, "accessLevel": ACCESS_LEVEL_FULL_ACCESS},
        granted_by=None,
        actor={
            "employeeId": str(uuid.uuid4()),
            "firstName": "Pat",
            "lastName": "Admin",
            "role": "SUPERADMIN",
        },
    )
    assert len(audited) == 1
    assert audited[0].action == AUDIT_ACTION_CREATED
    assert audited[0].module_name == "Clients"
    assert audited[0].access_level == ACCESS_LEVEL_FULL_ACCESS
    assert audited[0].actor_name == "Pat Admin"


@pytest.mark.asyncio
async def test_update_records_updated_audit() -> None:
    employee_id = uuid.uuid4()
    grant_id = uuid.uuid4()
    row = SimpleNamespace(
        grant_id=grant_id,
        employee_id=employee_id,
        module_id=3,
        submodule_id=None,
        access_level=ACCESS_LEVEL_READ_ONLY,
        granted_by=None,
        granted_date=None,
        status=GRANT_STATUS_ACTIVE,
        module=SimpleNamespace(module_name="Clients", has_submodules=False),
        submodule=None,
    )
    emp_result = MagicMock()
    emp_result.scalar_one_or_none.return_value = SimpleNamespace(
        employee_id=employee_id,
        first_name="Ada",
        last_name="L",
        employee_code=None,
        business_employee_id=None,
        role="EMPLOYEE",
    )
    grant_result = MagicMock()
    grant_result.scalar_one_or_none.return_value = row

    audited: list[AccessGrantAudit] = []
    session = AsyncMock(spec=AsyncSession)
    session.flush = AsyncMock()
    session.execute = AsyncMock(side_effect=[emp_result, grant_result])
    session.add = audited.append

    await update_grant_access_level(
        session,
        employee_id=employee_id,
        grant_id=grant_id,
        access_level=ACCESS_LEVEL_FULL_ACCESS,
        granted_by=None,
        actor={"firstName": "Pat", "lastName": "HR", "role": "HR"},
    )
    assert len(audited) == 1
    assert audited[0].action == AUDIT_ACTION_UPDATED
    assert audited[0].previous_access_level == ACCESS_LEVEL_READ_ONLY
    assert audited[0].access_level == ACCESS_LEVEL_FULL_ACCESS


@pytest.mark.asyncio
async def test_revoke_records_revoked_audit() -> None:
    employee_id = uuid.uuid4()
    grant_id = uuid.uuid4()
    row = SimpleNamespace(
        grant_id=grant_id,
        employee_id=employee_id,
        module_id=3,
        submodule_id=None,
        access_level=ACCESS_LEVEL_FULL_ACCESS,
        granted_by=None,
        granted_date=None,
        status=GRANT_STATUS_ACTIVE,
        module=SimpleNamespace(module_name="Clients", has_submodules=False),
        submodule=None,
    )
    emp_result = MagicMock()
    emp_result.scalar_one_or_none.return_value = SimpleNamespace(
        employee_id=employee_id,
        first_name="Ada",
        last_name="L",
        employee_code=None,
        business_employee_id=None,
        role="EMPLOYEE",
    )
    grant_result = MagicMock()
    grant_result.scalar_one_or_none.return_value = row

    audited: list[AccessGrantAudit] = []
    session = AsyncMock(spec=AsyncSession)
    session.flush = AsyncMock()
    session.execute = AsyncMock(side_effect=[emp_result, grant_result])
    session.add = audited.append

    await revoke_grant(
        session,
        employee_id=employee_id,
        grant_id=grant_id,
        granted_by=None,
        actor={"firstName": "Pat", "lastName": "Admin", "role": "ADMIN"},
    )
    assert len(audited) == 1
    assert audited[0].action == AUDIT_ACTION_REVOKED


@pytest.mark.asyncio
async def test_record_grant_audit_is_append_only_helper() -> None:
    """record_grant_audit only inserts; no update/delete path exists."""
    session = AsyncMock(spec=AsyncSession)
    session.flush = AsyncMock()
    added: list[object] = []
    session.add = added.append

    grant = SimpleNamespace(
        grant_id=uuid.uuid4(),
        module_id=1,
        submodule_id=None,
        access_level=ACCESS_LEVEL_FULL_ACCESS,
        module=SimpleNamespace(module_name="Company Setup"),
        submodule=None,
    )
    target = SimpleNamespace(
        employee_id=uuid.uuid4(),
        first_name="Super",
        last_name="Admin",
        employee_code=None,
        business_employee_id=None,
    )
    row = await record_grant_audit(
        session,
        action=AUDIT_ACTION_CREATED,
        grant=grant,  # type: ignore[arg-type]
        target=target,  # type: ignore[arg-type]
        actor=None,
    )
    assert isinstance(row, AccessGrantAudit)
    assert len(added) == 1
    assert added[0] is row


@pytest.mark.asyncio
async def test_require_audit_trail_allows_company_setup_grant(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.modules.rbac.access.get_settings",
        lambda: SimpleNamespace(auth_bypass=False),
    )
    employee_id = uuid.uuid4()
    user = {"employeeId": str(employee_id), "role": "SUPERADMIN"}

    async def _resolve(
        _db: object,
        *,
        employee_id: uuid.UUID,
        module_key: str,
        submodule_key: str | None = None,
    ) -> str | None:
        if module_key == "companySetup":
            return ACCESS_LEVEL_FULL_ACCESS
        return None

    monkeypatch.setattr(
        "app.modules.rbac.access.resolve_module_access_level",
        _resolve,
    )
    checker = require_audit_trail_access()
    db = AsyncMock(spec=AsyncSession)
    out = await checker(user=user, db=db)
    assert out is user


@pytest.mark.asyncio
async def test_require_audit_trail_denies_without_grant(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.modules.rbac.access.get_settings",
        lambda: SimpleNamespace(auth_bypass=False),
    )

    async def _resolve(*_a: object, **_k: object) -> None:
        return None

    monkeypatch.setattr(
        "app.modules.rbac.access.resolve_module_access_level",
        _resolve,
    )
    checker = require_audit_trail_access()
    db = AsyncMock(spec=AsyncSession)
    with pytest.raises(HTTPException) as exc:
        await checker(
            user={"employeeId": str(uuid.uuid4()), "role": "EMPLOYEE"},
            db=db,
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_upsert_flat_still_works_with_audit_side_effect() -> None:
    """Regression: upsert returns grant payload when audit rows are also added."""
    employee_id = uuid.uuid4()
    module = SimpleNamespace(
        module_id=3,
        module_name="Clients",
        has_submodules=False,
        status=MASTER_STATUS_ACTIVE,
        submodules=[],
    )
    emp_result = MagicMock()
    emp_result.scalar_one_or_none.return_value = SimpleNamespace(
        employee_id=employee_id,
        first_name="A",
        last_name="B",
        employee_code=None,
        business_employee_id=None,
    )
    mod_result = MagicMock()
    mod_result.scalar_one_or_none.return_value = module
    existing_result = MagicMock()
    existing_result.scalars.return_value.first.return_value = None

    created_grants: list[EmployeeAccessGrant] = []

    def add(obj: object) -> None:
        if isinstance(obj, EmployeeAccessGrant):
            created_grants.append(obj)

    session = AsyncMock(spec=AsyncSession)
    session.add = add
    session.flush = AsyncMock()
    session.execute = AsyncMock(
        side_effect=[emp_result, mod_result, existing_result]
    )

    payload = await upsert_employee_grants(
        session,
        employee_id=employee_id,
        payload={"moduleId": 3, "accessLevel": ACCESS_LEVEL_FULL_ACCESS},
        granted_by=None,
    )
    assert len(created_grants) == 1
    assert payload[0]["moduleId"] == 3
    assert payload[0]["moduleName"] == "Clients"
