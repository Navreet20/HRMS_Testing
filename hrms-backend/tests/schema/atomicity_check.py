"""All-or-nothing test: if any step of "assign an asset" fails, nothing from that assign may be left behind.

An assign is four writes (see README.md):
    1. insert the asset_assignments row      2. set assets.status = 'Assigned'
    3. insert the activity_log row           4. insert the email_deliveries row (the outbox)
Cases:
    A. all four succeed inside one transaction            -> all four rows exist
    B. step 4 fails inside one transaction                -> none of the four exists
    C. step 2 fails inside one transaction                -> none of the four exists
    D. step 4 fails with NO transaction (the mistake)     -> steps 1-3 stay behind: half-done data
    E. a rolled-back save still uses up an asset number   -> a gap in asset_number_seq (expected, harmless)
A client save (client + its locations + one log row each) and a project save (project + members + allocations
+ one log row each) must also be all or nothing:
    F. a client save whose second location is refused     -> no client, no location, no log row
    G. a project save whose allocation is refused          -> no project, no member, no allocation, no log row
    H. the same project save with a valid allocation       -> every row exists
The failures are made by sending a value one of our CHECK constraints or triggers refuses, so each failure is
checked to come from the rule we expect.

Builds its own throwaway database (hrms_atomic) from the models and drops it at the end.
Run it from this folder:  python3 atomicity_check.py
"""
import asyncio
import sys
from decimal import Decimal

import asyncpg

from dbtools import build, connect, drop_database

DB = "hrms_atomic"
EMP = "00000000-0000-0000-0000-000000000001"
OFFICE = "00000000-0000-0000-0000-0000000000c1"
CLIENT = "00000000-0000-0000-0000-0000000000c2"


def asset_id(n):
    return f"00000000-0000-0000-0000-0000000000a{n}"


async def assign_steps(conn, asset, status="Assigned", email_status="pending"):
    """The four writes of an assign, in order. Whoever calls this decides whether they share a transaction."""
    await conn.execute("INSERT INTO asset_assignments(asset_id, assigned_to_employee_id, assigned_date) "
                       "VALUES ($1, $2, current_date)", asset, EMP)
    await conn.execute("UPDATE assets SET status = $1 WHERE id = $2", status, asset)
    await conn.execute("INSERT INTO activity_log(actor_employee_id, action, entity_type, entity_id) "
                       "VALUES ($1, 'assigned', 'asset', $2)", EMP, asset)
    await conn.execute("INSERT INTO email_deliveries(event_key, to_email, subject, body, status) "
                       "VALUES ('asset_assigned', 'a@example.com', 's', 'b', $1)", email_status)


async def state(conn, asset):
    """What exists for this asset right now: (assignments, status, log rows, email rows)."""
    return (await conn.fetchval("SELECT count(*) FROM asset_assignments WHERE asset_id = $1", asset),
            await conn.fetchval("SELECT status FROM assets WHERE id = $1", asset),
            await conn.fetchval("SELECT count(*) FROM activity_log WHERE entity_id = $1", asset),
            await conn.fetchval("SELECT count(*) FROM email_deliveries"))


async def try_steps(conn, asset, in_transaction, **kw):
    """Returns the name of the constraint that refused a step, or None if every step worked."""
    try:
        if in_transaction:
            async with conn.transaction():
                await assign_steps(conn, asset, **kw)
        else:
            await assign_steps(conn, asset, **kw)
    except asyncpg.PostgresError as e:
        return e.constraint_name
    return None


async def log(conn, entity_type, entity_id):
    await conn.execute("INSERT INTO activity_log(actor_employee_id, action, entity_type, entity_id) "
                       "VALUES ($1, 'created', $2, $3)", EMP, entity_type, entity_id)


async def client_save(conn, name, second_location_typed):
    """An Internal client with two office-pick locations. A typed second location is refused by the trigger."""
    client = await conn.fetchval("INSERT INTO clients(client_name, account_owner, client_category) "
                                 "VALUES ($1, $2, 'INTERNAL') RETURNING id", name, EMP)
    await log(conn, "client", client)
    for typed in (False, second_location_typed):
        location = await conn.fetchval(
            "INSERT INTO client_locations(client_id, office_location_id, address_line_1, country) "
            "VALUES ($1, $2, $3, $4) RETURNING id",
            client, None if typed else OFFICE, "1 Road" if typed else None, "US" if typed else None)
        await log(conn, "client_location", location)


async def project_save(conn, name, billable_percentage):
    """A project with an account owner and a billable allocation. A billable allocation needs a percentage."""
    project = await conn.fetchval("INSERT INTO projects(name, client_id, start_date) "
                                  "VALUES ($1, $2, current_date) RETURNING id", name, CLIENT)
    await log(conn, "project", project)
    member = await conn.fetchval("INSERT INTO project_members(project_id, employee_id, role) "
                                 "VALUES ($1, $2, 'ACCOUNT_OWNER') RETURNING id", project, EMP)
    await log(conn, "project_member", member)
    allocation = await conn.fetchval(
        "INSERT INTO allocations(project_id, employee_id, allocation_percentage, is_billable, billable_percentage, "
        "start_date) VALUES ($1, $2, 50, true, $3, current_date) RETURNING id", project, EMP, billable_percentage)
    await log(conn, "allocation", allocation)


async def saved(conn, save, *args):
    """Run one save in its own transaction. Returns None, or the constraint name (or message) that refused it."""
    try:
        async with conn.transaction():
            await save(conn, *args)
    except asyncpg.PostgresError as e:
        return e.constraint_name or str(e)
    return None


async def counts(conn):
    """(clients, client locations, projects, members, allocations, log rows) right now."""
    return tuple([await conn.fetchval(f"SELECT count(*) FROM {t}") for t in (
        "clients", "client_locations", "projects", "project_members", "allocations", "activity_log")])


async def main():
    await build(DB)
    conn = await connect(DB)
    failures = []

    def check(ok, text):
        print(("PASS  " if ok else "FAIL  ") + text)
        if not ok:
            failures.append(text)

    await conn.execute("INSERT INTO asset_categories(name, is_serial_required, has_low_stock_tracking) "
                       "VALUES ('Laptop', true, true)")
    for n in range(1, 5):
        await conn.execute("INSERT INTO assets(id, asset_code, asset_category_id) "
                           "VALUES ($1, $2, (SELECT id FROM asset_categories LIMIT 1))", asset_id(n), f"COG-0000{n}")
    await conn.execute("INSERT INTO employees(id, first_name, last_name) VALUES ($1, 'Ann', 'One')", EMP)

    print("\n== A. all four steps, one transaction")
    refused_by = await try_steps(conn, asset_id(1), True)
    check(refused_by is None, "the transaction committed")
    s = await state(conn, asset_id(1))
    check(s == (1, "Assigned", 1, 1), f"all four writes exist {s}")

    print("\n== B. step 4 (the email row) fails inside one transaction")
    emails_before = (await state(conn, asset_id(2)))[3]
    refused_by = await try_steps(conn, asset_id(2), True, email_status="bogus")
    check(refused_by == "ck_email_deliveries_status", "the transaction was refused by ck_email_deliveries_status")
    s = await state(conn, asset_id(2))
    check(s == (0, "In Stock", 0, emails_before),
          f"nothing was left behind: no assignment, status still 'In Stock', no log row, no new email {s}")

    print("\n== C. step 2 (the status change) fails inside one transaction")
    emails_before = (await state(conn, asset_id(3)))[3]
    refused_by = await try_steps(conn, asset_id(3), True, status="Nope")
    check(refused_by == "ck_assets_status", "the transaction was refused by ck_assets_status")
    s = await state(conn, asset_id(3))
    check(s == (0, "In Stock", 0, emails_before),
          f"nothing was left behind, including the assignment inserted in step 1 {s}")

    print("\n== D. the same failure as B, but with NO transaction (shows why one is required)")
    refused_by = await try_steps(conn, asset_id(4), False, email_status="bogus")
    check(refused_by == "ck_email_deliveries_status", "step 4 was refused by ck_email_deliveries_status")
    s = await state(conn, asset_id(4))
    check(s[0] == 1 and s[1] == "Assigned" and s[2] == 1,
          f"steps 1-3 stayed behind, a half-done assign with no email {s}  <- this is what the service must never do")

    print("\n== E. a rolled-back save still uses up an asset number")
    first = await conn.fetchval("SELECT nextval('asset_number_seq')")
    tx = conn.transaction()
    await tx.start()
    await conn.fetchval("SELECT nextval('asset_number_seq')")
    await tx.rollback()
    after = await conn.fetchval("SELECT nextval('asset_number_seq')")
    check(after == first + 2, f"number {first} used, one number lost in the rollback, next is {after} (a gap, as documented)")

    await conn.execute("INSERT INTO locations(id, name, address_line_1, timezone) VALUES ($1, 'Dallas', '1 Main', 'UTC')",
                       OFFICE)
    await conn.execute("INSERT INTO clients(id, client_name, account_owner, client_category) "
                       "VALUES ($1, 'Acme', $2, 'DIRECT')", CLIENT, EMP)

    print("\n== F. a client save whose second location is refused")
    before = await counts(conn)
    refused_by = await saved(conn, client_save, "Globex", True)
    check(refused_by is not None and "office locations" in refused_by,
          "the transaction was refused by the location trigger (Internal client, typed address)")
    check(await counts(conn) == before, f"nothing was left behind: no client, no location, no log row {await counts(conn)}")

    print("\n== G. a project save whose allocation is refused")
    before = await counts(conn)
    refused_by = await saved(conn, project_save, "Acme Portal", None)
    check(refused_by == "ck_allocations_billable", "the transaction was refused by ck_allocations_billable")
    check(await counts(conn) == before,
          f"nothing was left behind: no project, no member, no allocation, no log row {await counts(conn)}")

    print("\n== H. the same project save with a valid allocation")
    before = await counts(conn)
    refused_by = await saved(conn, project_save, "Acme Portal", Decimal("40"))
    check(refused_by is None, "the transaction committed")
    after = await counts(conn)
    check(after == (before[0], before[1], before[2] + 1, before[3] + 1, before[4] + 1, before[5] + 3),
          f"the project, its member, its allocation and 3 log rows exist {after}")

    await conn.close()
    await drop_database(DB)
    print(f"\n{'ALL PASSED' if not failures else str(len(failures)) + ' FAILED'}; throwaway database dropped")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    asyncio.run(main())
