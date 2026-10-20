"""All-or-nothing test for portal multi-write flows (same idea as asset assign).

Approving leave is three writes that must share one transaction:
    1. set leave_requests.status = 'Approved' (+ decided_*)
    2. insert activity_log
    3. insert email_deliveries (outbox)
Balances are a VIEW — no fourth write. Overdraw prevention is a service lock, not these steps.

Cases:
    A. all three succeed in one transaction     -> request Approved, log + email exist
    B. email step fails in one transaction      -> status still Pending, no log, no email
    C. bad status value fails in one transaction-> still Pending, no log, no email
    D. same as B with NO transaction            -> half-done (Approved + log, no email) — service must never do this

Builds throwaway database hrms_portal_atomic and drops it at the end.
Run:  python3 portal_atomicity_check.py
"""
import asyncio
import sys

import asyncpg

from dbtools import build, connect, drop_database

DB = "hrms_portal_atomic"
EMP = "00000000-0000-0000-0000-000000000001"
LT = "00000000-0000-0000-0000-0000000000b1"


def leave_id(n):
    return f"00000000-0000-0000-0000-0000000000c{n}"


async def approve_steps(conn, leave, status="Approved", email_status="pending"):
    await conn.execute(
        "UPDATE leave_requests SET status = $1, decided_by_employee_id = $2, decided_at = now() "
        "WHERE id = $3",
        status, EMP, leave,
    )
    await conn.execute(
        "INSERT INTO activity_log(actor_employee_id, action, entity_type, entity_id) "
        "VALUES ($1, 'approved', 'leave_request', $2)",
        EMP, leave,
    )
    await conn.execute(
        "INSERT INTO email_deliveries(event_key, to_email, subject, body, status) "
        "VALUES ('leave_approved', 'a@example.com', 's', 'b', $1)",
        email_status,
    )


async def state(conn, leave):
    return (
        await conn.fetchval("SELECT status FROM leave_requests WHERE id = $1", leave),
        await conn.fetchval("SELECT count(*) FROM activity_log WHERE entity_id = $1", leave),
        await conn.fetchval("SELECT count(*) FROM email_deliveries WHERE event_key = 'leave_approved'"),
    )


async def try_steps(conn, leave, in_transaction, **kw):
    try:
        if in_transaction:
            async with conn.transaction():
                await approve_steps(conn, leave, **kw)
        else:
            await approve_steps(conn, leave, **kw)
    except asyncpg.PostgresError as e:
        return e.constraint_name
    return None


async def seed_leave(conn, leave):
    await conn.execute(
        "INSERT INTO leave_requests(id, employee_id, leave_type_id, from_date, to_date, status, submitted_at) "
        "VALUES ($1, $2, $3, '2026-10-08', '2026-10-08', 'Pending', now())",
        leave, EMP, LT,
    )
    await conn.execute(
        "INSERT INTO leave_request_days(leave_request_id, leave_date, half_part) "
        "VALUES ($1, '2026-10-08', 'full')",
        leave,
    )


async def main():
    await build(DB)
    conn = await connect(DB)
    failures = []

    def check(ok, text):
        print(("PASS  " if ok else "FAIL  ") + text)
        if not ok:
            failures.append(text)

    await conn.execute("INSERT INTO employees(id, first_name, last_name) VALUES ($1, 'Portal', 'Tester')", EMP)
    await conn.execute("INSERT INTO leave_types(id, name) VALUES ($1, 'Annual')", LT)
    for n in range(1, 5):
        await seed_leave(conn, leave_id(n))

    print("\n== A. all three steps, one transaction")
    refused = await try_steps(conn, leave_id(1), True)
    check(refused is None, "the transaction committed")
    s = await state(conn, leave_id(1))
    check(s[0] == "Approved" and s[1] == 1 and s[2] >= 1, f"approved + log + email exist {s}")

    print("\n== B. email step fails inside one transaction")
    emails_before = (await state(conn, leave_id(2)))[2]
    refused = await try_steps(conn, leave_id(2), True, email_status="bogus")
    check(refused == "ck_email_deliveries_status", "refused by ck_email_deliveries_status")
    s = await state(conn, leave_id(2))
    check(
        s[0] == "Pending" and s[1] == 0 and s[2] == emails_before,
        f"nothing left behind; still Pending {s}",
    )

    print("\n== C. bad status fails inside one transaction")
    logs_before = (await state(conn, leave_id(3)))[1]
    emails_before_c = (await state(conn, leave_id(3)))[2]
    refused = await try_steps(conn, leave_id(3), True, status="Nope")
    check(refused == "ck_leave_requests_status", "refused by ck_leave_requests_status")
    s = await state(conn, leave_id(3))
    check(
        s[0] == "Pending" and s[1] == logs_before and s[2] == emails_before_c,
        f"nothing left behind; still Pending {s}",
    )

    print("\n== D. email failure with NO transaction (half-done)")
    refused = await try_steps(conn, leave_id(4), False, email_status="bogus")
    check(refused == "ck_email_deliveries_status", "email step refused")
    s = await state(conn, leave_id(4))
    check(
        s[0] == "Approved" and s[1] == 1,
        f"steps 1-2 stayed behind without email {s}  <- service must never do this",
    )

    await conn.close()
    await drop_database(DB)
    print(f"\n{'ALL PASSED' if not failures else str(len(failures)) + ' FAILED'}; throwaway database dropped")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    asyncio.run(main())
