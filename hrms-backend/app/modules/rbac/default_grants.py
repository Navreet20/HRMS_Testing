"""Default / bootstrap RBAC grants (DATA-10 Super Admin)."""

from __future__ import annotations

import logging
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.tables import RbacModule
from app.modules.rbac.catalog import MODULE_COMPANY_SETUP, MODULE_KEY_COMPANY_SETUP
from app.modules.rbac.grants import (
    ACCESS_LEVEL_FULL_ACCESS,
    upsert_employee_grants,
)
from app.modules.rbac.service import MASTER_STATUS_ACTIVE

logger = logging.getLogger(__name__)


async def ensure_bootstrap_company_setup_grant(
    db: AsyncSession,
    *,
    employee_id: uuid.UUID,
    granted_by: uuid.UUID | None = None,
) -> bool:
    """Idempotent Active grant: Company Setup → full_access (RBAC-DATA-10).

    Seeds the first Super Admin so Manage Access is reachable on a fresh
    tenant. Covers every Active Company Setup submodule. Re-run does not create duplicates
    (upsert reactivates / updates the natural key). Returns True when the
    grant was upserted; False if the Company Setup catalog row is missing.
    """
    try:
        emp_id = (
            employee_id
            if isinstance(employee_id, uuid.UUID)
            else uuid.UUID(str(employee_id))
        )
    except (TypeError, ValueError):
        logger.warning(
            "Invalid employee_id for Company Setup bootstrap grant: %r",
            employee_id,
        )
        return False

    module_result = await db.execute(
        select(RbacModule)
        .where(RbacModule.module_key == MODULE_KEY_COMPANY_SETUP)
        .options(selectinload(RbacModule.submodules))
    )
    module = module_result.scalar_one_or_none()
    if module is None or (module.status or MASTER_STATUS_ACTIVE) != MASTER_STATUS_ACTIVE:
        logger.warning(
            "RBAC catalog missing Active module %r; skip Company Setup grant for %s",
            MODULE_COMPANY_SETUP,
            emp_id,
        )
        return False

    payload: dict[str, object] = {
        "moduleId": module.module_id,
        "accessLevel": ACCESS_LEVEL_FULL_ACCESS,
    }
    if module.has_submodules:
        payload["submoduleIds"] = [
            sub.submodule_id
            for sub in module.submodules or []
            if (sub.status or MASTER_STATUS_ACTIVE) == MASTER_STATUS_ACTIVE
        ]

    actor = granted_by if granted_by is not None else emp_id
    await upsert_employee_grants(
        db,
        employee_id=emp_id,
        payload=payload,
        granted_by=actor,
    )
    return True
