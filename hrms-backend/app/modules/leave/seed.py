"""Leave catalog seed — matches live HRMS: leave *types* only, not policies/lines.

Live HRMS (`ensure_schema_and_seed` → `seed_default_leave_types`) inserts the six
fixed leave types at startup. Leave *policies* and their *lines* are created by
HR/Admin via Company Setup → Leave Policies (`POST /leave-policies`), never
auto-seeded.
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tables import LeaveType
from app.modules.leave.constants import DEFAULT_LEAVE_TYPES, UNPAID_LEAVE_TYPE_NAME


async def seed_default_leave_types(db: AsyncSession) -> int:
    """Insert the six PDF leave types if missing. Idempotent.

    New schema ``leave_types`` columns: id, name, is_unlimited.
    (Descriptions / status / audit columns from the old schema are gone.)
    """
    added = 0
    for name, _description in DEFAULT_LEAVE_TYPES:
        exists = await db.execute(
            select(LeaveType.id).where(func.lower(LeaveType.name) == name.lower())
        )
        if exists.scalar_one_or_none() is not None:
            continue
        db.add(
            LeaveType(
                name=name,
                is_unlimited=(name == UNPAID_LEAVE_TYPE_NAME),
            )
        )
        added += 1
    if added:
        await db.flush()
    return added
