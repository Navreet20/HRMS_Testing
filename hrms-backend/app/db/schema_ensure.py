"""Startup schema init for the redesigned (snake_case, 37-table) schema.

``ensure_schema_and_seed`` (called from app/main.py and scripts/bootstrap_db.py):

  1. ``app.schema_ensure_v2.ensure_schema`` - creates the 37 business tables, installs the triggers and writes the
     RBAC module / submodule lists.
  2. Additive ALTERs for columns added to ``employees`` after the first release (create_all never alters).

Nothing else is created: no auth_* / user_access / compat_* / UPPERCASE tables. Auth is Microsoft Entra + a stateless
app JWT; the Entra link is the nullable ``employees.entra_oid`` column.
"""
from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

import app.models  # noqa: F401  (registers the 37 business tables on Base.metadata)
from app.db.session import engine
from app.schema_ensure_v2 import SCHEMA_LOCK_KEY
from app.schema_ensure_v2 import ensure_schema as ensure_schema_v2

logger = logging.getLogger(__name__)

# Columns added to employees after the first release of the new schema (see employee_master.Employee).
EMPLOYEE_ADDED_COLUMNS_SQL: tuple[str, ...] = (
    "ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_system_account boolean DEFAULT false",
    "ALTER TABLE employees ADD COLUMN IF NOT EXISTS theme_preference varchar(16)",
    "ALTER TABLE employees ADD COLUMN IF NOT EXISTS quick_actions_preference varchar(512)",
    "ALTER TABLE employees ADD COLUMN IF NOT EXISTS avatar_object_key varchar(500)",
    "ALTER TABLE employees ADD COLUMN IF NOT EXISTS company_name varchar(200)",
    "ALTER TABLE employees ADD COLUMN IF NOT EXISTS department_label varchar(150)",
    "ALTER TABLE employees ADD COLUMN IF NOT EXISTS entra_oid varchar(128)",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_employees_entra_oid ON employees (entra_oid) WHERE entra_oid IS NOT NULL",
)

# leave_types is a fixed system list ("created by the system at startup"): insert the missing names.
LEAVE_TYPES_SEED_SQL = """
INSERT INTO leave_types (id, name, is_unlimited)
SELECT gen_random_uuid(), v.name, v.is_unlimited
FROM (VALUES ('Personal Leave', false), ('Sick Leave', false), ('Maternity Leave', false),
             ('Paternity Leave', false), ('Medical Leave', false), ('Unpaid Leave', true)) AS v(name, is_unlimited)
WHERE NOT EXISTS (SELECT 1 FROM leave_types t WHERE lower(t.name) = lower(v.name))
"""


async def ensure_schema(conn: AsyncConnection) -> None:
    """Additive ALTERs on existing tables (idempotent)."""
    for statement in EMPLOYEE_ADDED_COLUMNS_SQL:
        await conn.execute(text(statement))
    await conn.execute(text(LEAVE_TYPES_SEED_SQL))


async def ensure_schema_and_seed() -> None:
    """schema_ensure_v2 (37 tables + triggers + RBAC seed) -> additive employees ALTERs."""
    await ensure_schema_v2(engine)
    async with engine.begin() as conn:
        await conn.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": SCHEMA_LOCK_KEY})
        await ensure_schema(conn)
    logger.info("Schema ensured (37 business tables + employees extras).")
