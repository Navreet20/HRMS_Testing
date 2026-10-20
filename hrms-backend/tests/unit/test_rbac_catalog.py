"""RBAC-DATA-1: system-seeded module / submodule reference catalog."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import uuid

import pytest
from sqlalchemy import Delete, Select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tables import EmployeeAccessGrant, RbacModule, RbacSubmodule
from app.modules.rbac.catalog import (
    DEFAULT_RBAC_CATALOG,
    MODULE_ASSET_MANAGEMENT,
    MODULE_AUDIT_TRAIL,
    MODULE_CLIENTS,
    MODULE_COMPANY_SETUP,
    MODULE_DASHBOARD,
    MODULE_EMPLOYEE_PORTAL,
    MODULE_EMPLOYEES,
    MODULE_KEY_BY_NAME,
    MODULE_KEY_EMPLOYEE_PORTAL,
    MODULE_PROJECTS,
    SUBMODULE_COMPANY_PROFILE,
    SUBMODULE_DEPARTMENTS,
    SUBMODULE_DESIGNATIONS,
    SUBMODULE_KEY_BY_NAME,
    SUBMODULE_LEAVE_POLICY,
    SUBMODULE_LOCATIONS,
    SUBMODULE_MANAGE,
    SUBMODULE_ONBOARDING,
    SUBMODULE_RBAC,
    SUBMODULE_SELF,
)
from app.modules.rbac.router import router as rbac_router
from app.modules.rbac.service import (
    MASTER_STATUS_ACTIVE,
    MASTER_STATUS_INACTIVE,
    list_active_modules,
    seed_default_rbac_catalog,
)


def test_rbac_module_routes_are_read_only() -> None:
    paths = {getattr(route, "path", "") for route in rbac_router.routes}
    assert "/rbac/modules" in paths
    # No Create/Edit Module UI or API in v1.
    assert "/rbac/modules/{module_id}" not in paths
    write_methods = {
        method
        for route in rbac_router.routes
        if getattr(route, "path", "") == "/rbac/modules"
        for method in (getattr(route, "methods", None) or set())
    }
    assert write_methods == {"GET"}


def test_default_catalog_covers_grantable_modules() -> None:
    names = [entry.name for entry in DEFAULT_RBAC_CATALOG]
    assert names == [
        MODULE_DASHBOARD,
        MODULE_EMPLOYEES,
        MODULE_CLIENTS,
        MODULE_PROJECTS,
        MODULE_ASSET_MANAGEMENT,
        MODULE_AUDIT_TRAIL,
        MODULE_COMPANY_SETUP,
    ]
    submodules = {
        entry.name: [sub.name for sub in entry.submodules]
        for entry in DEFAULT_RBAC_CATALOG
        if entry.has_submodules
    }
    assert submodules == {
        MODULE_EMPLOYEES: [SUBMODULE_ONBOARDING],
        MODULE_COMPANY_SETUP: [
            SUBMODULE_COMPANY_PROFILE,
            SUBMODULE_DEPARTMENTS,
            SUBMODULE_LOCATIONS,
            SUBMODULE_DESIGNATIONS,
            SUBMODULE_LEAVE_POLICY,
            SUBMODULE_RBAC,
        ],
    }
    orders = [entry.display_order for entry in DEFAULT_RBAC_CATALOG]
    assert orders == sorted(orders)
    assert len(set(orders)) == len(orders)


def test_catalog_keys_are_unique_and_stable() -> None:
    keys = [entry.key for entry in DEFAULT_RBAC_CATALOG]
    assert len(keys) == len(set(keys))
    assert MODULE_KEY_BY_NAME == {
        MODULE_DASHBOARD: "dashboard",
        MODULE_EMPLOYEES: "employees",
        MODULE_CLIENTS: "customers",
        MODULE_PROJECTS: "projects",
        MODULE_ASSET_MANAGEMENT: "assets",
        MODULE_AUDIT_TRAIL: "auditTrail",
        MODULE_COMPANY_SETUP: "companySetup",
    }
    assert SUBMODULE_KEY_BY_NAME == {
        SUBMODULE_ONBOARDING: "onboarding",
        SUBMODULE_COMPANY_PROFILE: "companyProfile",
        SUBMODULE_DEPARTMENTS: "departments",
        SUBMODULE_LOCATIONS: "locations",
        SUBMODULE_DESIGNATIONS: "designations",
        SUBMODULE_LEAVE_POLICY: "leavePolicy",
        SUBMODULE_RBAC: "rbac",
    }


def test_employee_portal_is_derived_not_grantable() -> None:
    assert MODULE_EMPLOYEE_PORTAL not in MODULE_KEY_BY_NAME
    assert MODULE_KEY_EMPLOYEE_PORTAL not in MODULE_KEY_BY_NAME.values()


def _seed_session(
    *,
    modules: dict[str, object],
    subs_by_module: dict[int, list[object]],
    extra_modules: list[object] | None = None,
    grants: list[object] | None = None,
) -> AsyncMock:
    """Mock ``execute`` in seed order: (module, submodules) per entry, then all modules.

    Grant queries (flat-grant expansion) are answered from ``grants`` and do
    not advance the module / submodule sequence.
    """
    phase = {
        "kind": "module",
        "module_queue": [entry.name.lower() for entry in DEFAULT_RBAC_CATALOG],
        "last_module": "",
    }

    async def execute(stmt):  # noqa: ANN001
        result = MagicMock()
        if isinstance(stmt, Delete):
            return result
        if isinstance(stmt, Select):
            text = str(stmt)
            if "EMPLOYEE_ACCESS_GRANT" in text:
                module_id = getattr(modules[phase["last_module"]], "module_id")
                rows = [g for g in grants or [] if g.module_id == module_id]
                if '"SUBMODULE_ID" IS NULL' in text:
                    result.scalars.return_value.all.return_value = [
                        g for g in rows if g.submodule_id is None
                    ]
                else:
                    result.all.return_value = [
                        (g.employee_id, g.submodule_id)
                        for g in rows
                        if g.submodule_id is not None
                    ]
                return result
            if text.startswith('SELECT "SUBMODULE"."SUBMODULE_ID" \nFROM'):
                mod = modules[phase["last_module"]]
                result.all.return_value = [
                    (s.submodule_id,)
                    for s in subs_by_module.get(getattr(mod, "module_id"), [])
                ]
                return result
        if phase["kind"] == "module" and phase["module_queue"]:
            name = phase["module_queue"].pop(0)
            result.scalar_one_or_none.return_value = modules.get(name)
            phase["kind"] = "sub"
            phase["last_module"] = name
            return result
        scalars = MagicMock()
        if phase["kind"] == "sub":
            mod = modules[phase["last_module"]]
            scalars.all.return_value = list(
                subs_by_module.get(getattr(mod, "module_id"), [])
            )
            phase["kind"] = "module"
        else:
            unique = MagicMock()
            unique.all.return_value = [*modules.values(), *(extra_modules or [])]
            scalars.unique.return_value = unique
        result.scalars.return_value = scalars
        return result

    session = AsyncMock(spec=AsyncSession)
    session.flush = AsyncMock()
    session.execute = AsyncMock(side_effect=execute)
    return session


def _existing_catalog() -> tuple[dict[str, SimpleNamespace], dict[int, list]]:
    modules: dict[str, SimpleNamespace] = {}
    subs_by_module: dict[int, list] = {}
    for entry in DEFAULT_RBAC_CATALOG:
        modules[entry.name.lower()] = SimpleNamespace(
            module_id=entry.display_order,
            module_name=entry.name,
            has_submodules=entry.has_submodules,
            display_order=entry.display_order,
            status=MASTER_STATUS_ACTIVE,
            submodules=[],
        )
        subs_by_module[entry.display_order] = [
            SimpleNamespace(
                submodule_id=entry.display_order * 100 + order,
                submodule_name=sub.name,
                display_order=order,
                status=MASTER_STATUS_ACTIVE,
            )
            for order, sub in enumerate(entry.submodules, start=1)
        ]
    return modules, subs_by_module


@pytest.mark.asyncio
async def test_seed_inserts_full_catalog_once() -> None:
    modules: dict[str, RbacModule] = {}
    subs_by_module: dict[int, list[RbacSubmodule]] = {}
    added: list[object] = []
    next_module_id = {"n": 1}

    session = _seed_session(modules=modules, subs_by_module=subs_by_module)

    def add(obj: object) -> None:
        added.append(obj)
        if isinstance(obj, RbacModule):
            obj.module_id = next_module_id["n"]
            next_module_id["n"] += 1
            modules[obj.module_name.lower()] = obj
            subs_by_module[obj.module_id] = []

    session.add = add

    expected_subs = sum(len(entry.submodules) for entry in DEFAULT_RBAC_CATALOG)
    counts = await seed_default_rbac_catalog(session)
    assert counts == {
        "modules": len(DEFAULT_RBAC_CATALOG),
        "submodules": expected_subs,
    }
    assert len([a for a in added if isinstance(a, RbacModule)]) == len(
        DEFAULT_RBAC_CATALOG
    )
    assert len([a for a in added if isinstance(a, RbacSubmodule)]) == expected_subs


@pytest.mark.asyncio
async def test_seed_is_idempotent_when_catalog_already_present() -> None:
    modules, subs_by_module = _existing_catalog()
    session = _seed_session(modules=modules, subs_by_module=subs_by_module)
    session.add = MagicMock()

    counts = await seed_default_rbac_catalog(session)
    assert counts == {"modules": 0, "submodules": 0}
    session.add.assert_not_called()
    assert all(m.status == MASTER_STATUS_ACTIVE for m in modules.values())
    assert _delete_statements(session) == []


@pytest.mark.asyncio
async def test_seed_deactivates_legacy_employee_portal_row() -> None:
    modules, subs_by_module = _existing_catalog()
    self_sub = SimpleNamespace(submodule_name=SUBMODULE_SELF, status=MASTER_STATUS_ACTIVE)
    manage_sub = SimpleNamespace(
        submodule_name=SUBMODULE_MANAGE, status=MASTER_STATUS_ACTIVE
    )
    portal = SimpleNamespace(
        module_id=99,
        module_name=MODULE_EMPLOYEE_PORTAL,
        status=MASTER_STATUS_ACTIVE,
        submodules=[self_sub, manage_sub],
    )
    session = _seed_session(
        modules=modules, subs_by_module=subs_by_module, extra_modules=[portal]
    )
    session.add = MagicMock()

    await seed_default_rbac_catalog(session)

    assert portal.status == MASTER_STATUS_INACTIVE
    assert self_sub.status == MASTER_STATUS_INACTIVE
    assert manage_sub.status == MASTER_STATUS_INACTIVE
    assert all(m.status == MASTER_STATUS_ACTIVE for m in modules.values())

    deletes = _delete_statements(session)
    assert len(deletes) == 1
    sql = str(deletes[0].compile(compile_kwargs={"literal_binds": True}))
    assert 'DELETE FROM "EMPLOYEE_ACCESS_GRANT"' in sql
    assert "IN (99)" in sql


@pytest.mark.asyncio
async def test_seed_expands_flat_grant_into_submodule_grants() -> None:
    modules, subs_by_module = _existing_catalog()
    company = modules[MODULE_COMPANY_SETUP.lower()]
    company_sub_ids = [s.submodule_id for s in subs_by_module[company.module_id]]
    holder = uuid.uuid4()
    other = uuid.uuid4()
    flat = SimpleNamespace(
        grant_id=uuid.uuid4(),
        employee_id=holder,
        module_id=company.module_id,
        submodule_id=None,
        access_level="read_only",
        granted_by=None,
        granted_date=None,
        status="Active",
    )
    revoked_flat = SimpleNamespace(
        grant_id=uuid.uuid4(),
        employee_id=other,
        module_id=company.module_id,
        submodule_id=None,
        access_level="full_access",
        granted_by=None,
        granted_date=None,
        status="Revoked",
    )
    # Holder already has full access on one submodule — it must not be overwritten.
    existing_sub = SimpleNamespace(
        employee_id=holder,
        module_id=company.module_id,
        submodule_id=company_sub_ids[0],
    )
    session = _seed_session(
        modules=modules,
        subs_by_module=subs_by_module,
        grants=[flat, revoked_flat, existing_sub],
    )
    added: list[object] = []
    session.add = added.append

    await seed_default_rbac_catalog(session)

    new_grants = [a for a in added if isinstance(a, EmployeeAccessGrant)]
    assert sorted(g.submodule_id for g in new_grants) == company_sub_ids[1:]
    assert all(g.employee_id == holder for g in new_grants)
    assert all(g.access_level == "read_only" for g in new_grants)
    assert all(g.status == "Active" for g in new_grants)

    deletes = _delete_statements(session)
    assert len(deletes) == 1
    sql = str(deletes[0].compile(compile_kwargs={"literal_binds": True}))
    assert flat.grant_id.hex in sql.replace("-", "")
    assert revoked_flat.grant_id.hex in sql.replace("-", "")


def _delete_statements(session: AsyncMock) -> list[Delete]:
    return [
        call.args[0]
        for call in session.execute.await_args_list
        if isinstance(call.args[0], Delete)
    ]


@pytest.mark.asyncio
async def test_list_active_modules_omits_inactive_submodule() -> None:
    company = SimpleNamespace(
        module_id=7,
        module_name=MODULE_COMPANY_SETUP,
        has_submodules=True,
        display_order=7,
        status=MASTER_STATUS_ACTIVE,
        submodules=[
            SimpleNamespace(
                submodule_id=1,
                module_id=7,
                submodule_name="Current",
                display_order=1,
                status=MASTER_STATUS_ACTIVE,
            ),
            SimpleNamespace(
                submodule_id=2,
                module_id=7,
                submodule_name="Deprecated",
                display_order=2,
                status=MASTER_STATUS_INACTIVE,
            ),
        ],
    )
    assets = SimpleNamespace(
        module_id=5,
        module_name=MODULE_ASSET_MANAGEMENT,
        has_submodules=False,
        display_order=5,
        status=MASTER_STATUS_ACTIVE,
        submodules=[],
    )

    result = MagicMock()
    scalars = MagicMock()
    unique = MagicMock()
    unique.all.return_value = [assets, company]
    scalars.unique.return_value = unique
    result.scalars.return_value = scalars

    session = AsyncMock(spec=AsyncSession)
    session.execute = AsyncMock(return_value=result)

    payload = await list_active_modules(session)
    assert [row["moduleName"] for row in payload] == [
        MODULE_ASSET_MANAGEMENT,
        MODULE_COMPANY_SETUP,
    ]
    assert payload[0]["hasSubmodules"] is False
    assert payload[0]["submodules"] == []
    assert [s["submoduleName"] for s in payload[1]["submodules"]] == ["Current"]
