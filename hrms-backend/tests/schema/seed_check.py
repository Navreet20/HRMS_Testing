"""Seed test: the RBAC module and submodule list in app/seeds/rbac.py is written to the database at every start.
    1. the list checks itself: a duplicate id or key, or a submodule of an unknown module, stops the start
    2. a new database gets exactly the list; running the start again changes nothing
    3. a database with an old value (the key auditTrail) is updated to match the list
    4. adding a module to the list inserts it; retiring it (is_active=False) updates the row and keeps its grants
    5. a row that is no longer in the list is left alone (never deleted)

Builds its own throwaway database (hrms_seed) from the models and drops it at the end.
Run it from this folder:  python3 seed_check.py
"""
import asyncio
import sys

from dbtools import TABLES, connect, create_database, drop_database, make_engine
from app.models import Base
from app.schema_ensure import ensure_schema
from app.seeds.rbac import MODULES, SUBMODULES, ModuleRow, SubmoduleRow, check_lists, seed_statements

DB = "hrms_seed"
EMP = "00000000-0000-0000-0000-000000000001"


async def main():
    failures = []

    def check(ok, text):
        print(("PASS  " if ok else "FAIL  ") + text)
        if not ok:
            failures.append(text)

    print("== 1. the list checks itself")

    def refused(modules, submodules):
        try:
            check_lists(modules, submodules)
            return False
        except ValueError:
            return True

    check(not refused(MODULES, SUBMODULES), "the real list is consistent")
    check(refused(MODULES + (ModuleRow(1, "reports", "Reports", 7),), SUBMODULES), "a reused module id is refused")
    check(refused(MODULES + (ModuleRow(7, "employees", "Again", 7),), SUBMODULES), "a reused module key is refused")
    check(refused(MODULES, SUBMODULES + (SubmoduleRow(8, 99, "orphan", "Orphan", 1),)),
          "a submodule of a module that is not in the list is refused")

    await create_database(DB)
    engine = make_engine(DB)
    tables = [Base.metadata.tables[t] for t in TABLES]
    conn = await connect(DB)

    async def keys(table, column):
        return {r[0]: r[1] for r in await conn.fetch(f"SELECT id, {column} FROM {table}")}

    async def apply(modules, submodules):
        async with engine.begin() as c:
            for statement in seed_statements(modules, submodules):
                await c.execute(statement)

    print("\n== 2. a new database gets exactly the list")
    await ensure_schema(engine, tables)
    check(await keys("modules", "module_key") == {m.id: m.key for m in MODULES}, "modules match the list")
    check(await keys("submodules", "submodule_key") == {s.id: s.key for s in SUBMODULES}, "submodules match the list")
    await ensure_schema(engine, tables)
    check(await conn.fetchval("SELECT count(*) FROM modules") == len(MODULES), "a second start adds nothing")

    print("\n== 3. an old value is updated to match the list")
    await conn.execute("UPDATE modules SET module_key = 'auditTrail', display_name = 'Audit Trail' WHERE id = 5")
    await conn.execute("UPDATE submodules SET display_order = 99 WHERE id = 7")
    await ensure_schema(engine, tables)
    check(await conn.fetchval("SELECT module_key || ',' || display_name FROM modules WHERE id = 5") == "activityLog,Activity Log",
          "module 5 is renamed back to activityLog / Activity Log")
    check(await conn.fetchval("SELECT display_order FROM submodules WHERE id = 7") == 6, "submodule 7's order is restored")

    print("\n== 4. add a module, then retire it")
    reports = ModuleRow(7, "reports", "Reports", 7)
    await apply(MODULES + (reports,), SUBMODULES)
    check(await conn.fetchval("SELECT module_key FROM modules WHERE id = 7") == "reports", "the new module is inserted")
    await conn.execute("INSERT INTO employees(id, first_name, last_name) VALUES ($1, 'Ann', 'One')", EMP)
    await conn.execute("INSERT INTO employee_access_grants(employee_id, module_id, access_level, granted_by_employee_id) "
                       "VALUES ($1, 7, 'View', $1)", EMP)
    await apply(MODULES + (reports._replace(is_active=False),), SUBMODULES)
    check(await conn.fetchval("SELECT is_active FROM modules WHERE id = 7") is False, "retiring sets is_active = false")
    check(await conn.fetchval("SELECT count(*) FROM employee_access_grants WHERE module_id = 7") == 1,
          "the grant on the retired module is kept")

    print("\n== 5. a row no longer in the list is left alone")
    await ensure_schema(engine, tables)
    check(await conn.fetchval("SELECT count(*) FROM modules WHERE id = 7") == 1, "module 7 is not deleted by the start")

    await conn.close()
    await engine.dispose()
    await drop_database(DB)
    print(f"\n{'ALL PASSED' if not failures else str(len(failures)) + ' FAILED'}; throwaway database dropped")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    asyncio.run(main())
