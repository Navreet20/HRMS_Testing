"""Race test: several sessions try to assign the SAME asset at the same moment. Exactly one must win.

Each session does what a simple service would do, in one transaction:
    1. read the asset's status  (all of them see 'In Stock')
    2. wait until every session has read it, so all reach the next step together
    3. insert the assignment, set the asset to 'Assigned', commit
There is no locking in this code on purpose. The only thing that can stop the extra sessions is the
database itself: the partial unique index uq_asset_assignments_one_open.

A second race: departments moved under each other at the same moment must never form a loop (the trigger
trg_departments_no_loop, which holds an advisory lock so parent changes run one at a time). The same race for
employees set to report to each other (trg_employees_no_manager_loop), and many sessions creating employees at
once must never share an emp_id (employee_number_seq).

Clients and projects: several sessions create an active client with the same name (in different capitals) at the
same moment, and exactly one wins (uq_clients_active_name). Many sessions save clients and projects at once, and no
client code or project number is handed out twice.

Builds its own throwaway database (hrms_race) from the models and drops it at the end.
Run it from this folder:  python3 concurrency_check.py
"""
import asyncio
import sys

import asyncpg

from dbtools import build, connect, drop_database

DB = "hrms_race"
ASSET = "00000000-0000-0000-0000-0000000000a1"


def employee(n):
    return f"00000000-0000-0000-0000-{n:012d}"


async def one_session(emp, barrier):
    """Returns (employee, status it saw, name of the constraint that refused it or None)."""
    conn = await connect(DB)
    try:
        tx = conn.transaction()
        await tx.start()
        saw = await conn.fetchval("SELECT status FROM assets WHERE id = $1", ASSET)
        await barrier.wait()  # nobody writes until everybody has read
        try:
            await conn.execute("INSERT INTO asset_assignments(asset_id, assigned_to_employee_id, assigned_date) "
                               "VALUES ($1, $2, current_date)", ASSET, emp)
            await conn.execute("UPDATE assets SET status = 'Assigned' WHERE id = $1", ASSET)
            await tx.commit()
            return emp, saw, None
        except asyncpg.PostgresError as e:
            await tx.rollback()
            return emp, saw, e.constraint_name
    finally:
        await conn.close()


async def run_race(admin, n):
    await admin.execute("DELETE FROM asset_assignments")
    await admin.execute("UPDATE assets SET status = 'In Stock' WHERE id = $1", ASSET)
    barrier = asyncio.Barrier(n)
    results = await asyncio.gather(*(one_session(employee(i), barrier) for i in range(1, n + 1)))
    return dict(
        won=[r for r in results if r[2] is None], lost=[r for r in results if r[2] is not None],
        saw=[r[1] for r in results],
        open_rows=await admin.fetchval("SELECT count(*) FROM asset_assignments WHERE returned_date IS NULL"),
        all_rows=await admin.fetchval("SELECT count(*) FROM asset_assignments"),
        status=await admin.fetchval("SELECT status FROM assets WHERE id = $1", ASSET),
        holder=str(await admin.fetchval("SELECT assigned_to_employee_id FROM asset_assignments "
                                        "WHERE returned_date IS NULL")))


async def move_department(child, parent, barrier):
    """Move `child` under `parent` in its own transaction, all sessions starting together. Returns None or the error."""
    conn = await connect(DB)
    try:
        tx = conn.transaction()
        await tx.start()
        await barrier.wait()
        try:
            await conn.execute("UPDATE departments SET parent_department_id = (SELECT id FROM departments WHERE name = $2) "
                               "WHERE name = $1", child, parent)
            await tx.commit()
            return None
        except asyncpg.PostgresError as e:
            await tx.rollback()
            return str(e)
    finally:
        await conn.close()


async def has_loop(admin):
    return await admin.fetchval("""WITH RECURSIVE walk(start, id, depth) AS (
        SELECT id, parent_department_id, 1 FROM departments
        UNION ALL SELECT w.start, d.parent_department_id, w.depth + 1 FROM walk w JOIN departments d ON d.id = w.id
        WHERE w.depth < 10)
        SELECT count(*) FROM walk WHERE id = start""") > 0


async def set_manager(emp, manager, barrier):
    """Set `emp` to report to `manager` in its own transaction, all sessions starting together. Returns None or the error."""
    conn = await connect(DB)
    try:
        tx = conn.transaction()
        await tx.start()
        await barrier.wait()
        try:
            await conn.execute("UPDATE employees SET reporting_manager_id = $2 WHERE id = $1", emp, manager)
            await tx.commit()
            return None
        except asyncpg.PostgresError as e:
            await tx.rollback()
            return str(e)
    finally:
        await conn.close()


async def has_manager_loop(admin):
    return await admin.fetchval("""WITH RECURSIVE walk(start, id, depth) AS (
        SELECT id, reporting_manager_id, 1 FROM employees
        UNION ALL SELECT w.start, e.reporting_manager_id, w.depth + 1 FROM walk w JOIN employees e ON e.id = w.id
        WHERE w.depth < 10)
        SELECT count(*) FROM walk WHERE id = start""") > 0


async def main():
    await build(DB)
    admin = await connect(DB)
    await admin.execute("INSERT INTO asset_categories(name, is_serial_required, has_low_stock_tracking) "
                        "VALUES ('Laptop', true, true)")
    await admin.execute("INSERT INTO assets(id, asset_code, asset_category_id) "
                        "VALUES ($1, 'COG-00001', (SELECT id FROM asset_categories LIMIT 1))", ASSET)
    for i in range(1, 11):
        await admin.execute("INSERT INTO employees(id, first_name, last_name) VALUES ($1, 'Emp', $2)",
                            employee(i), str(i))

    failures = []

    def check(ok, text):
        print(("PASS  " if ok else "FAIL  ") + text)
        if not ok:
            failures.append(text)

    for n in (2, 10):
        print(f"\n== {n} sessions assign the same asset at the same moment")
        r = await run_race(admin, n)
        check(all(s == "In Stock" for s in r["saw"]),
              "every session read the status as 'In Stock' before any of them wrote (so a status check alone cannot stop the race)")
        check(len(r["won"]) == 1, f"exactly 1 session committed (got {len(r['won'])})")
        check(len(r["lost"]) == n - 1, f"the other {n - 1} were refused (got {len(r['lost'])})")
        check(all(c == "uq_asset_assignments_one_open" for _, _, c in r["lost"]),
              "every refusal names uq_asset_assignments_one_open (not some other error)")
        check(r["open_rows"] == 1 and r["all_rows"] == 1,
              f"the table holds exactly 1 assignment, and it is open (rows={r['all_rows']}, open={r['open_rows']})")
        check(r["status"] == "Assigned", f"asset status is 'Assigned' (got {r['status']!r})")
        check(bool(r["won"]) and r["holder"] == r["won"][0][0], "the open assignment belongs to the session that committed")

    print("\n== 10 sessions take 20 asset numbers each at the same moment")

    async def take_numbers(barrier):
        conn = await connect(DB)
        try:
            await barrier.wait()
            return [row[0] for row in await conn.fetch("SELECT nextval('asset_number_seq') FROM generate_series(1, 20)")]
        finally:
            await conn.close()

    barrier = asyncio.Barrier(10)
    numbers = [x for part in await asyncio.gather(*(take_numbers(barrier) for _ in range(10))) for x in part]
    check(len(numbers) == 200, f"all 200 numbers were handed out (got {len(numbers)})")
    check(len(set(numbers)) == 200, "no number was given to two sessions")

    for names in (("A", "B"), ("A", "B", "C")):
        print(f"\n== {len(names)} departments are moved under each other at the same moment (a loop if all succeed)")
        await admin.execute("DELETE FROM departments")
        for n in names:
            await admin.execute("INSERT INTO departments(name) VALUES ($1)", n)
        ring = list(zip(names, names[1:] + names[:1]))  # A under B, B under C, ..., last under A
        barrier = asyncio.Barrier(len(ring))
        results = await asyncio.gather(*(move_department(c, p, barrier) for c, p in ring))
        won = [r for r in results if r is None]
        lost = [r for r in results if r is not None]
        check(len(won) == len(names) - 1 and len(lost) == 1,
              f"exactly {len(names) - 1} moves succeeded and 1 was refused (got {len(won)} and {len(lost)})")
        check(all("cannot be placed under itself" in r for r in lost), "the refusal is the loop error from the trigger")
        check(not await has_loop(admin), "the departments table has no loop afterwards")

    for n in (2, 3):
        print(f"\n== {n} employees are set to report to each other at the same moment (a loop if all succeed)")
        await admin.execute("UPDATE employees SET reporting_manager_id = NULL")
        ring = [(employee(i), employee(i % n + 1)) for i in range(1, n + 1)]  # 1 reports to 2, ..., n reports to 1
        barrier = asyncio.Barrier(n)
        results = await asyncio.gather(*(set_manager(e, m, barrier) for e, m in ring))
        lost = [r for r in results if r is not None]
        check(len(lost) == 1, f"exactly {n - 1} changes succeeded and 1 was refused (got {n - len(lost)} and {len(lost)})")
        check(all("cannot report to themselves" in r for r in lost), "the refusal is the reporting-line loop error from the trigger")
        check(not await has_manager_loop(admin), "the employees table has no reporting-line loop afterwards")

    print("\n== 10 sessions create 10 employees each at the same moment")

    async def create_employees(s, barrier):
        conn = await connect(DB)
        try:
            await barrier.wait()
            for k in range(10):
                await conn.execute("INSERT INTO employees(first_name, last_name) VALUES ($1, $2)", f"S{s}", str(k))
        finally:
            await conn.close()

    barrier = asyncio.Barrier(10)
    await asyncio.gather(*(create_employees(s, barrier) for s in range(10)))
    ids = await admin.fetchval("SELECT count(*) FROM employees WHERE first_name LIKE 'S%'")
    distinct = await admin.fetchval("SELECT count(DISTINCT emp_id) FROM employees")
    total = await admin.fetchval("SELECT count(*) FROM employees")
    check(ids == 100, f"all 100 employees were created (got {ids})")
    check(distinct == total, "no emp_id was given to two employees")

    async def create_client(name, barrier):
        """Create one active client in its own transaction. Returns None or the constraint that refused it."""
        conn = await connect(DB)
        try:
            tx = conn.transaction()
            await tx.start()
            await barrier.wait()
            try:
                await conn.execute("INSERT INTO clients(client_name, account_owner, client_category) "
                                   "VALUES ($1, $2, 'DIRECT')", name, employee(1))
                await tx.commit()
                return None
            except asyncpg.PostgresError as e:
                await tx.rollback()
                return e.constraint_name
        finally:
            await conn.close()

    names = ["Same Name", "SAME NAME", "same name", "Same name", "sAME nAME"]
    print(f"\n== {len(names)} sessions create the same active client name (different capitals) at the same moment")
    barrier = asyncio.Barrier(len(names))
    results = await asyncio.gather(*(create_client(n, barrier) for n in names))
    check(results.count(None) == 1, f"exactly 1 session committed (got {results.count(None)})")
    check(all(r == "uq_clients_active_name" for r in results if r is not None),
          "every refusal names uq_clients_active_name")
    check(await admin.fetchval("SELECT count(*) FROM clients WHERE lower(client_name) = 'same name'") == 1,
          "the table holds exactly 1 client with that name")

    async def save_many(n, barrier):
        """Save 5 clients, each with one project, in one transaction."""
        conn = await connect(DB)
        try:
            await barrier.wait()
            async with conn.transaction():
                for i in range(5):
                    client = await conn.fetchval(
                        "INSERT INTO clients(client_name, account_owner, client_category) "
                        "VALUES ($1, $2, 'DIRECT') RETURNING id", f"Client {n}-{i}", employee(1))
                    await conn.execute("INSERT INTO projects(name, client_id, start_date) VALUES ($1, $2, current_date)",
                                       f"Project {n}-{i}", client)
        finally:
            await conn.close()

    print("\n== 10 sessions save 5 clients and 5 projects each at the same moment")
    barrier = asyncio.Barrier(10)
    await asyncio.gather(*(save_many(n, barrier) for n in range(10)))
    clients = await admin.fetch("SELECT client_code FROM clients WHERE client_name LIKE 'Client %'")
    projects = await admin.fetch("SELECT project_number FROM projects")
    check(len(clients) == 50 and len({r[0] for r in clients}) == 50, f"50 clients, 50 different client codes (got {len(clients)})")
    check(len(projects) == 50 and len({r[0] for r in projects}) == 50, f"50 projects, 50 different project numbers (got {len(projects)})")

    await admin.close()
    await drop_database(DB)
    print(f"\n{'ALL PASSED' if not failures else str(len(failures)) + ' FAILED'}; throwaway database dropped")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    asyncio.run(main())
