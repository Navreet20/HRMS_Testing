"""Creates any missing tables from the models, installs the triggers and inserts the fixed lists. Safe to run on
every start.

create_all only CREATES missing tables; it never alters an existing one. A changed column needs an explicit
ALTER TABLE step added here. A transaction-level advisory lock makes a second copy of the app that starts at
the same moment wait for the first, instead of racing it. The lock is released when the transaction ends,
even if the app crashes. A failure is raised, never skipped, so a broken schema stops the start.

The triggers (append-only on activity_log, no loops on departments, no delete or code change on assets, no emp_id
change or delete past Draft and no reporting-line loops on employees, no full day mixed with a half day on
leave_request_days, the Clients and Projects guards) are created together with a new table, and
re-applied here on every start (they are written to be repeatable), so a database whose table already existed
gets them too. The RBAC modules and submodules are written here from app/seeds/rbac.py: new rows are inserted and
existing ones updated to match the list, so editing that list is how a module is added, renamed or retired.
"""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

import app.models  # noqa: F401  (imports every model so Base.metadata knows all tables)
from app.models.activity_log import APPEND_ONLY_SQL
from app.models.assets import ASSET_GUARD_SQL
from app.models.clients_projects import CLIENTS_PROJECTS_SQL
from app.models.company_setup import DEPARTMENT_LOOP_SQL
from app.models.employee_master import EMPLOYEE_GUARD_SQL, EMPLOYEE_MANAGER_LOOP_SQL
from app.models.portal import LEAVE_DAY_HALF_EXCLUSION_SQL
from app.models.base import Base
from app.seeds.rbac import seed_statements as rbac_seed_statements

SCHEMA_LOCK_KEY = 8_204_117  # any fixed number; every copy of the app must use the same one

TRIGGERS = (
    ("activity_log", APPEND_ONLY_SQL),
    ("departments", DEPARTMENT_LOOP_SQL),
    ("assets", ASSET_GUARD_SQL),
    ("employees", EMPLOYEE_GUARD_SQL + EMPLOYEE_MANAGER_LOOP_SQL),
    ("leave_request_days", LEAVE_DAY_HALF_EXCLUSION_SQL),
    *CLIENTS_PROJECTS_SQL.items(),
)


async def ensure_schema(engine: AsyncEngine, tables=None) -> None:
    """Create the missing tables, (re)install the triggers and insert the fixed lists.
    `tables` limits it to some Table objects (default: all of them)."""
    async with engine.begin() as conn:
        await conn.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": SCHEMA_LOCK_KEY})
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=tables))
        for table, statements in TRIGGERS:
            if tables is None or Base.metadata.tables[table] in tables:
                for statement in statements:
                    await conn.exec_driver_sql(statement)
        if tables is None or Base.metadata.tables["submodules"] in tables:
            for statement in rbac_seed_statements():
                await conn.execute(statement)
