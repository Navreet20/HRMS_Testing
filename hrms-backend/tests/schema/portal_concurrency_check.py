"""Portal race tests (same idea as assets concurrency_check).

1) Two sessions insert the SAME employee+week timesheet.
   DB must allow exactly one winner via uq_timesheets_employee_week.

2) Two sessions approve leave that would overdraw the balance.
   DB has NO overdraw constraint today — both can succeed.
   That proves remaining-days protection belongs in the SERVICE (lock + check),
   not only in a naive read-then-write.

Builds throwaway database hrms_portal_race and drops it at the end.
Run:  python3 portal_concurrency_check.py
"""
import asyncio
import datetime as dt
import sys

import asyncpg

from dbtools import build, connect, drop_database

DB = "hrms_portal_race"
EMP = "00000000-0000-0000-0000-000000000001"
LT = "00000000-0000-0000-0000-0000000000b1"
LEAVE = "00000000-0000-0000-0000-0000000000c1"
LEAVE2 = "00000000-0000-0000-0000-0000000000c2"


def ts_id(n):
    return f"00000000-0000-0000-0000-0000000000a{n}"


async def insert_week(n, barrier):
    conn = await connect(DB)
    try:
        tx = conn.transaction()
        await tx.start()
        await barrier.wait()
        try:
            await conn.execute(
                "INSERT INTO timesheets(id, employee_id, week_start_date, status) "
                "VALUES ($1, $2, '2026-10-06', 'Draft')",
                ts_id(n), EMP,
            )
            await tx.commit()
            return n, None
        except asyncpg.PostgresError as e:
            await tx.rollback()
            return n, e.constraint_name
    finally:
        await conn.close()


async def approve_leave(leave, barrier):
    """Read remaining via view, then approve — no lock (the naive pattern)."""
    conn = await connect(DB)
    try:
        tx = conn.transaction()
        await tx.start()
        remaining = await conn.fetchval(
            "SELECT remaining_days FROM employee_leave_balance_view "
            "WHERE employee_id = $1 AND leave_type_id = $2 AND leave_year = 2026",
            EMP, LT,
        )
        # View may not exist in create_all — compute inline if needed
        if remaining is None:
            remaining = await conn.fetchval(
                """
                SELECT b.entitled_days + b.carried_forward_days - COALESCE((
                    SELECT SUM(CASE d.half_part WHEN 'full' THEN 1.0 WHEN 'first' THEN 0.5
                               WHEN 'second' THEN 0.5 ELSE 0 END)
                    FROM leave_request_days d
                    JOIN leave_requests lr ON lr.id = d.leave_request_id
                    WHERE lr.employee_id = b.employee_id AND lr.leave_type_id = b.leave_type_id
                      AND lr.status = 'Approved' AND EXTRACT(YEAR FROM d.leave_date) = b.leave_year
                ), 0)
                FROM employee_leave_balances b
                WHERE b.employee_id = $1 AND b.leave_type_id = $2 AND b.leave_year = 2026
                """,
                EMP, LT,
            )
        await barrier.wait()
        try:
            # Naive: if remaining >= 1, approve (both sessions may see remaining=1)
            if remaining is not None and float(remaining) >= 1:
                await conn.execute(
                    "UPDATE leave_requests SET status = 'Approved', decided_at = now() WHERE id = $1",
                    leave,
                )
            await tx.commit()
            return leave, None, remaining
        except asyncpg.PostgresError as e:
            await tx.rollback()
            return leave, e.constraint_name, remaining
    finally:
        await conn.close()


async def main():
    await build(DB)
    admin = await connect(DB)
    failures = []

    def check(ok, text):
        print(("PASS  " if ok else "FAIL  ") + text)
        if not ok:
            failures.append(text)

    await admin.execute("INSERT INTO employees(id, first_name, last_name) VALUES ($1, 'Portal', 'Tester')", EMP)
    await admin.execute("INSERT INTO leave_types(id, name) VALUES ($1, 'Annual')", LT)

    print("\n== 2 sessions insert the same employee+week timesheet")
    barrier = asyncio.Barrier(2)
    results = await asyncio.gather(insert_week(1, barrier), insert_week(2, barrier))
    won = [r for r in results if r[1] is None]
    lost = [r for r in results if r[1] is not None]
    check(len(won) == 1, f"exactly 1 timesheet insert committed (got {len(won)})")
    check(len(lost) == 1, f"the other was refused (got {len(lost)})")
    check(
        all(c == "uq_timesheets_employee_week" for _, c in lost),
        "refusal names uq_timesheets_employee_week",
    )
    n = await admin.fetchval(
        "SELECT count(*) FROM timesheets WHERE employee_id = $1 AND week_start_date = '2026-10-06'",
        EMP,
    )
    check(n == 1, f"table holds exactly 1 week row (got {n})")

    print("\n== 2 sessions approve leave when balance would overdraw (naive read-then-write)")
    # entitled 1 day; two pending full-day requests — both see remaining=1 if neither approved yet
    await admin.execute(
        "INSERT INTO employee_leave_balances(employee_id, leave_type_id, leave_year, entitled_days, carried_forward_days) "
        "VALUES ($1, $2, 2026, 1, 0)",
        EMP, LT,
    )
    for leave, day in ((LEAVE, dt.date(2026, 10, 8)), (LEAVE2, dt.date(2026, 10, 9))):
        await admin.execute(
            "INSERT INTO leave_requests(id, employee_id, leave_type_id, from_date, to_date, status, submitted_at) "
            "VALUES ($1, $2, $3, $4, $4, 'Pending', now())",
            leave, EMP, LT, day,
        )
        await admin.execute(
            "INSERT INTO leave_request_days(leave_request_id, leave_date, half_part) "
            "VALUES ($1, $2, 'full')",
            leave, day,
        )

    # Ensure view exists for remaining reads (models ship SQL string; create here)
    from app.models.portal import EMPLOYEE_LEAVE_BALANCE_VIEW_SQL
    await admin.execute(EMPLOYEE_LEAVE_BALANCE_VIEW_SQL)

    barrier = asyncio.Barrier(2)
    results = await asyncio.gather(
        approve_leave(LEAVE, barrier),
        approve_leave(LEAVE2, barrier),
    )
    approved = await admin.fetchval(
        "SELECT count(*) FROM leave_requests WHERE status = 'Approved'"
    )
    check(
        approved == 2,
        f"DB allowed {approved} approvals with only 1 entitled day — overdraw prevention is a SERVICE rule "
        "(lock employee leave rows / re-check remaining inside one transaction), not a DB unique today",
    )

    await admin.close()
    await drop_database(DB)
    print(f"\n{'ALL PASSED' if not failures else str(len(failures)) + ' FAILED'}; throwaway database dropped")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    asyncio.run(main())
