"""Portal index check: seed portal-sized data, EXPLAIN main screen queries.

Builds throwaway database hrms_portal_perf and drops it at the end.
Run:  python3 portal_explain_check.py
"""
import asyncio
import re

from dbtools import build, connect, drop_database

DB = "hrms_portal_perf"
KEY = re.compile(r"Index Scan|Index Only Scan|Bitmap (Heap|Index) Scan|Seq Scan|Execution Time")

QUERIES = [
    ("== P1  Employee week timesheet + items/hours (uq_timesheets_employee_week, ix_timesheet_items_timesheet_id)",
     """SELECT t.id, t.status, i.category, e.work_date, e.hours
FROM timesheets t
JOIN timesheet_items i ON i.timesheet_id = t.id
LEFT JOIN timesheet_day_entries e ON e.timesheet_item_id = i.id
WHERE t.employee_id = md5('emp'||7)::uuid
  AND t.week_start_date = DATE '2024-01-01' + 7 * 7"""),
    ("== P2  Manager queue: submitted timesheets (ix_timesheets_status)",
     """SELECT id, employee_id, week_start_date, submitted_at
FROM timesheets WHERE status = 'Submitted'
ORDER BY submitted_at NULLS LAST LIMIT 50"""),
    ("== P3  Who is off on a date (ix_leave_request_days_leave_date)",
     """SELECT lr.employee_id, d.half_part, lr.leave_type_id
FROM leave_request_days d
JOIN leave_requests lr ON lr.id = d.leave_request_id
WHERE d.leave_date = DATE '2024-01-01' + 100 AND lr.status = 'Approved'"""),
    ("== P4  Employee leave history (ix_leave_requests_employee_id)",
     """SELECT id, from_date, to_date, status, submitted_at
FROM leave_requests WHERE employee_id = md5('emp'||7)::uuid
ORDER BY submitted_at DESC LIMIT 50"""),
    ("== P5  Manage open employee_requests (ix_employee_requests_status_requested_at)",
     """SELECT id, request_kind, requested_for_employee_id, requested_at, status
FROM employee_requests WHERE status = 'Open'
ORDER BY requested_at LIMIT 50"""),
    ("== P6  Requests for one employee (ix_employee_requests_requested_for)",
     """SELECT id, request_kind, status, requested_at
FROM employee_requests WHERE requested_for_employee_id = md5('emp'||7)::uuid
ORDER BY requested_at DESC"""),
]


async def seed(conn):
    await conn.execute(
        "INSERT INTO employees(id, first_name, last_name) "
        "SELECT md5('emp'||g)::uuid, 'First'||g, 'Last'||g FROM generate_series(1, 500) g"
    )
    await conn.execute(
        "INSERT INTO clients(id, client_name, account_owner, client_category) "
        "VALUES (md5('cli1')::uuid, 'Client 1', md5('emp1')::uuid, 'DIRECT')"
    )
    await conn.execute(
        "INSERT INTO projects(id, name, client_id, start_date) "
        "SELECT md5('prj'||g)::uuid, 'Project '||g, md5('cli1')::uuid, '2026-01-01' FROM generate_series(1, 10) g"
    )
    await conn.execute("INSERT INTO leave_types(id, name) SELECT md5('lt'||g)::uuid, 'T'||g FROM generate_series(1, 3) g")
    await conn.execute(
        "INSERT INTO asset_categories(id, name) SELECT md5('ac'||g)::uuid, 'Cat'||g FROM generate_series(1, 3) g"
    )

    # 500 employees × 20 weeks = 10,000 timesheets
    await conn.execute("""
        INSERT INTO timesheets (id, employee_id, week_start_date, status, submitted_at)
        SELECT md5('ts'||e||'-'||w)::uuid, md5('emp'||e)::uuid,
               DATE '2024-01-01' + (w * 7),
               (ARRAY['Draft','Submitted','Approved','Rejected'])[1 + ((e+w) % 4)],
               CASE WHEN (e+w) % 4 > 0 THEN timestamptz '2024-01-01' + ((e*20+w)||' hours')::interval ELSE NULL END
        FROM generate_series(1, 500) e CROSS JOIN generate_series(0, 19) w
    """)
    await conn.execute("""
        INSERT INTO timesheet_items (id, timesheet_id, category, project_id, activity_type, sort_order)
        SELECT md5('ti'||e||'-'||w||'-'||s)::uuid, md5('ts'||e||'-'||w)::uuid,
               'Allocated Projects', md5('prj'||((e % 10)+1))::uuid, 'Development', s
        FROM generate_series(1, 500) e CROSS JOIN generate_series(0, 19) w CROSS JOIN generate_series(0, 1) s
    """)
    await conn.execute("""
        INSERT INTO timesheet_day_entries (id, timesheet_item_id, work_date, hours)
        SELECT md5('tde'||e||'-'||w||'-'||s)::uuid, md5('ti'||e||'-'||w||'-'||s)::uuid,
               DATE '2024-01-01' + (w * 7) + s, ((e+w+s) % 8 + 1)::numeric
        FROM generate_series(1, 500) e CROSS JOIN generate_series(0, 19) w CROSS JOIN generate_series(0, 1) s
    """)
    await conn.execute("""
        INSERT INTO leave_requests (id, employee_id, leave_type_id, from_date, to_date, status, submitted_at)
        SELECT md5('lr'||g)::uuid, md5('emp'||((g % 500)+1))::uuid, md5('lt'||((g % 3)+1))::uuid,
               DATE '2024-01-01' + (g % 300), DATE '2024-01-01' + (g % 300),
               (ARRAY['Pending','Approved','Rejected'])[1 + (g % 3)],
               timestamptz '2024-01-01' + (g||' minutes')::interval
        FROM generate_series(1, 3000) g
    """)
    await conn.execute("""
        INSERT INTO leave_request_days (id, leave_request_id, leave_date, half_part)
        SELECT md5('lrd'||g)::uuid, md5('lr'||g)::uuid,
               DATE '2024-01-01' + (g % 300), 'full'
        FROM generate_series(1, 3000) g
    """)
    await conn.execute("""
        INSERT INTO employee_requests (
          id, request_kind, requested_for_employee_id, submitted_by_employee_id,
          status, requested_at, field_name, new_value
        )
        SELECT md5('er'||g)::uuid, 'profile_update',
               md5('emp'||((g % 500)+1))::uuid, md5('emp'||((g % 500)+1))::uuid,
               (ARRAY['Open','Approved','Rejected','Completed'])[1 + (g % 4)],
               timestamptz '2024-01-01' + (g||' minutes')::interval,
               'phone', 'x'
        FROM generate_series(1, 5000) g
    """)
    await conn.execute("ANALYZE")


async def main():
    await build(DB)
    conn = await connect(DB)
    await seed(conn)
    for title, sql in QUERIES:
        print(title)
        for row in await conn.fetch("EXPLAIN (ANALYZE, BUFFERS)\n" + sql):
            if KEY.search(row[0]):
                print("  " + row[0].strip())
    await conn.close()
    await drop_database(DB)
    print("\ndone; throwaway database dropped")


if __name__ == "__main__":
    asyncio.run(main())
