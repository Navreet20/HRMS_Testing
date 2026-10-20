"""RBAC module/submodule catalog service (read only).

The catalog lives in the ``modules`` / ``submodules`` tables (``id``, ``module_key``, ``display_name``,
``display_order``, ``is_active``) and is written at start-up by ``schema_ensure`` from ``app/seeds/rbac.py``.
The API keeps its old camelCase shape (``moduleId``, ``moduleName``, ``status`` Active/Inactive, ...).
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tables import Module, Submodule

MASTER_STATUS_ACTIVE = "Active"
MASTER_STATUS_INACTIVE = "Inactive"
# Mirrors grants.GRANT_STATUS_ACTIVE; grants imports this module.
GRANT_STATUS_ACTIVE = "Active"


def _status(is_active: bool | None) -> str:
    return MASTER_STATUS_INACTIVE if is_active is False else MASTER_STATUS_ACTIVE


def _submodule_to_dict(row: Submodule) -> dict:
    return {
        "submoduleId": row.id,
        "moduleId": row.module_id,
        "submoduleKey": row.submodule_key,
        "submoduleName": row.display_name,
        "displayOrder": row.display_order,
        "status": _status(row.is_active),
    }


def _module_to_dict(row: Module, submodules: list[Submodule]) -> dict:
    subs = sorted(submodules, key=lambda s: (s.display_order, s.id))
    return {
        "moduleId": row.id,
        "moduleKey": row.module_key,
        "moduleName": row.display_name,
        "hasSubmodules": bool(subs),
        "displayOrder": row.display_order,
        "status": _status(row.is_active),
        "submodules": [_submodule_to_dict(s) for s in subs],
    }


async def seed_default_rbac_catalog(db: AsyncSession) -> dict[str, int]:
    """Catalog rows are seeded by schema_ensure (app/seeds/rbac.py); nothing to add here."""
    return {"modules": 0, "submodules": 0}


async def list_active_modules(db: AsyncSession) -> list[dict]:
    """Active modules with nested Active submodules, ordered for Manage Access."""
    modules = list(
        (
            await db.execute(
                select(Module).where(Module.is_active.is_(True)).order_by(Module.display_order, Module.id)
            )
        )
        .scalars()
        .all()
    )
    subs = list(
        (await db.execute(select(Submodule).where(Submodule.is_active.is_(True)))).scalars().all()
    )
    return [_module_to_dict(m, [s for s in subs if s.module_id == m.id]) for m in modules]
