"""Activity log protections, three layers:
    1. the trigger: UPDATE, DELETE and TRUNCATE are refused with an error; the retention job's flag allows a DELETE
    2. the database checks on details: a size limit and a refusal of known sensitive key names
    3. the code in app/activity_writer.py: only reviewed record types, actions and fields are accepted

Builds its own throwaway database (hrms_log) from the models and drops it at the end.
Run it from this folder:  python3 activity_log_check.py
"""
import asyncio
import sys
import uuid

import asyncpg

from dbtools import build, connect, drop_database, make_engine

DB = "hrms_log"
INSERT = "INSERT INTO activity_log(action, entity_type, entity_id) VALUES ('created', 'asset', gen_random_uuid())"


async def outcome(conn, sql):
    """None if the statement worked, else the error class name and constraint name."""
    try:
        await conn.execute(sql)
        return None
    except asyncpg.PostgresError as e:
        return (type(e).__name__, getattr(e, "constraint_name", None), str(e))


async def main():
    await build(DB)
    conn = await connect(DB)
    failures = []

    def check(ok, text):
        print(("PASS  " if ok else "FAIL  ") + text)
        if not ok:
            failures.append(text)

    print("== 1. the trigger")
    check(await outcome(conn, INSERT) is None, "adding a row works")
    check(await outcome(conn, INSERT) is None, "adding another row works")
    for sql, word in (("UPDATE activity_log SET action = 'x'", "UPDATE"), ("DELETE FROM activity_log", "DELETE"),
                      ("TRUNCATE activity_log", "TRUNCATE")):
        r = await outcome(conn, sql)
        check(r is not None and r[0] == "RestrictViolationError" and "append-only" in r[2],
              f"{word} is refused with the error 'activity_log is append-only'")
    check(await conn.fetchval("SELECT count(*) FROM activity_log") == 2, "no row was lost: 2 rows remain")
    tx = conn.transaction()
    await tx.start()
    await conn.execute("SET LOCAL app.allow_log_purge = 'on'")
    await conn.execute("DELETE FROM activity_log")
    await tx.commit()
    check(await conn.fetchval("SELECT count(*) FROM activity_log") == 0, "the retention job (flag on) can delete")
    await conn.execute(INSERT)
    check((await outcome(conn, "DELETE FROM activity_log"))[0] == "RestrictViolationError",
          "a delete is refused again once the flag is gone (it does not stay on after its transaction)")

    print("\n== 2. the database checks on details")
    big = "INSERT INTO activity_log(action,entity_type,entity_id,details) VALUES ('created','asset',gen_random_uuid(),'%s')"
    r = await outcome(conn, big % ('{"model": "' + "x" * 5000 + '"}'))
    check(r is not None and r[1] == "ck_activity_log_details_size", "details over 4 KB is refused (ck_activity_log_details_size)")
    r = await outcome(conn, big % '{"national_id": {"old": "1", "new": "2"}}')
    check(r is not None and r[1] == "ck_activity_log_details_no_sensitive_keys",
          "a sensitive key name is refused (ck_activity_log_details_no_sensitive_keys)")
    check(await outcome(conn, big % '{"status": {"old": "In Stock", "new": "Assigned"}}') is None, "a normal details value is accepted")
    r = await outcome(conn, big % '{"date_of_birth": {"old": "1990-01-01", "new": "1991-01-01"}}')
    check(r is not None and r[1] == "ck_activity_log_details_no_sensitive_keys", "date_of_birth as a key is refused by the database")

    print("\n== 3. the code (app/activity_writer.py)")
    from app.activity_writer import check_details, write_log

    def refused(entity, action, details):
        try:
            check_details(entity, action, details)
            return False
        except ValueError:
            return True

    check(not refused("asset", "updated", {"status": {"old": "In Stock", "new": "Assigned"}}), "an allowed field is accepted")
    check(refused("asset", "updated", {"salary": {"old": 1, "new": 2}}), "a field not on the list is refused")
    check(refused("asset", "updated", {"national_id": "123"}), "a sensitive field is refused")
    check(refused("employee_secret", "created", None), "an unknown record type is refused")
    check(refused("asset", "exploded", None), "an unknown action is refused")
    check(refused("asset", "viewed_sensitive", {"status": "x"}), "viewed_sensitive with details is refused")
    check(not refused("employee", "updated", {"department_id": {"old": None, "new": "d"}}), "an allowed employee field is accepted")
    for field in ("national_id_number_encrypted", "national_id_last4", "date_of_birth"):
        check(refused("employee", "updated", {field: {"old": "a", "new": "b"}}), f"employee {field} is refused (sensitive)")
    for field in ("personal_email", "phone_number", "ethnicity"):
        check(refused("employee", "updated", {field: {"old": "a", "new": "b"}}), f"employee {field} is refused (not on the list)")
    check(not refused("employee", "access_granted", {"grant_id": "g", "module_key": "assets", "access_level": "View"}),
          "access_granted with the grant fields is accepted")
    check(not refused("employee", "access_changed", {"access_level": "Edit", "previous_access_level": "View"}),
          "access_changed with the previous level is accepted")
    for entity, field in (("client", "client_name"), ("client_location", "city"), ("project", "end_customer_name"),
                          ("project_member", "role"), ("project_stakeholder", "email"),
                          ("allocation", "billable_percentage")):
        check(not refused(entity, "updated", {field: {"old": None, "new": "x"}}), f"{entity}: field {field} is accepted")
        check(refused(entity, "updated", {"salary": {"old": 1, "new": 2}}), f"{entity}: a field not on the list is refused")
    check(not refused("client", "deactivated", {"status": {"old": "ACTIVE", "new": "INACTIVE"}}),
          "client: archiving (deactivated) is accepted")
    check(refused("project", "updated", {"description": {"old": "a", "new": "b"}}),
          "project: description is not logged (unlimited text, could pass the 4 KB details limit)")
    engine = make_engine(DB)
    from sqlalchemy.ext.asyncio import AsyncSession
    async with AsyncSession(engine) as session:
        await write_log(session, action="created", entity_type="asset", entity_id=uuid.uuid4(),
                        details={"model": {"old": None, "new": "MacBook"}})
        await session.commit()
        try:
            await write_log(session, action="updated", entity_type="asset", entity_id=uuid.uuid4(), details={"password": "x"})
            ok = False
        except ValueError:
            ok = True
    await engine.dispose()
    check(ok, "write_log refuses a sensitive field and adds nothing")
    check(await conn.fetchval("SELECT count(*) FROM activity_log WHERE details ? 'model'") == 1, "write_log added the allowed row")

    await conn.close()
    await drop_database(DB)
    print(f"\n{'ALL PASSED' if not failures else str(len(failures)) + ' FAILED'}; throwaway database dropped")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    asyncio.run(main())
