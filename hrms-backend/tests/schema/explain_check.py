"""Index check: load realistic test data, then run the main screen queries with EXPLAIN (ANALYZE, BUFFERS).

This is a performance check, not a unit test: it does not test code, it shows whether Postgres uses the indexes
we defined for the main screens. It builds a throwaway database (hrms_perf), loads seed.sql (5,000 assets,
100,000 log rows, ...), runs every query below with EXPLAIN and prints the lines that show whether an index was
used and the time. Ids in the queries come from the seed: md5('emp'||7)::uuid is employee 7,
md5('ast'||123)::uuid is asset 123, md5('pol'||2)::uuid is policy 2, md5('dep'||3)::uuid is department 3,
md5('skl'||5)::uuid is skill 5.
A "Seq Scan" on a small table is normal: Postgres prefers it when an index would not help.
Run it from this folder:  python3 explain_check.py
"""
import asyncio
import re
from pathlib import Path

from dbtools import build, connect, drop_database

DB = "hrms_perf"
HERE = Path(__file__).resolve().parent
KEY = re.compile(r"Index Scan|Index Only Scan|Bitmap (Heap|Index) Scan|Seq Scan|Execution Time")
QUERIES = [
    ("== Q1   Offboarding: assets this employee still holds (ix_asset_assignments_employee_history)",
     """SELECT a.asset_code, c.name AS category, aa.assigned_date
FROM asset_assignments aa
JOIN assets a ON a.id = aa.asset_id
JOIN asset_categories c ON c.id = a.asset_category_id
WHERE aa.assigned_to_employee_id = md5('emp'||7)::uuid AND aa.returned_date IS NULL"""),
    ("== Q2   Category cards: count per category and status (ix_assets_category_status)",
     """SELECT c.name, a.status, count(*)
FROM assets a JOIN asset_categories c ON c.id = a.asset_category_id
GROUP BY c.name, a.status ORDER BY c.name, a.status"""),
    ("== Q3a  Employees on a leave policy: the count (ix_employees_leave_policy)",
     """SELECT count(*) FROM employees WHERE leave_policy_id = md5('pol'||2)::uuid"""),
    ("== Q3b  Can this department be deactivated? Any active employee in it (ix_employees_department)",
     """SELECT EXISTS (SELECT 1 FROM employees WHERE department_id = md5('dep'||3)::uuid AND status = 'Active')"""),
    ("== Q4   Asset detail: assignment history of one asset (ix_asset_assignments_asset_history)",
     """SELECT assigned_to_employee_id, assigned_date, returned_date, return_reason
FROM asset_assignments WHERE asset_id = md5('ast'||123)::uuid ORDER BY assigned_date DESC"""),
    ("== Q5   Activity history of one record, newest first (ix_activity_log_entity)",
     """SELECT occurred_at, actor_employee_id, action, details
FROM activity_log WHERE entity_type = 'asset' AND entity_id = md5('ast'||125)::uuid ORDER BY occurred_at DESC LIMIT 50"""),
    ("== Q6   Admin log: newest 50 in the last 7 days (ix_activity_log_occurred)",
     """SELECT occurred_at, actor_employee_id, action, entity_type, entity_id
FROM activity_log WHERE occurred_at >= now() - interval '7 days' AND occurred_at < now()
ORDER BY occurred_at DESC LIMIT 50"""),
    ("== Q7   Email sender: what is due now (partial index ix_email_deliveries_due)",
     """SELECT id, to_email FROM email_deliveries
WHERE status = 'pending' AND next_attempt_at <= now() ORDER BY next_attempt_at LIMIT 20"""),
    ("== Q8a Delivery log: failed emails, newest first (ix_email_deliveries_status_created)",
     """SELECT id, to_email, last_error, created_at FROM email_deliveries WHERE status = 'failed' ORDER BY created_at DESC LIMIT 50"""),
    ("== Q8b Delivery log: counts per status",
     """SELECT status, count(*) FROM email_deliveries GROUP BY status"""),
    ("== Q9  Holidays in one year (unique index on holiday_date, name)",
     """SELECT holiday_date, name, holiday_type FROM company_holidays
WHERE holiday_date >= date '2026-01-01' AND holiday_date < date '2027-01-01' ORDER BY holiday_date"""),
    ("== Q10a Find an asset by its code (uq_assets_asset_code)",
     """SELECT * FROM assets WHERE asset_code = 'COG-00123'"""),
    ("== Q10b Find an asset by serial number (uq_assets_serial_number)",
     """SELECT * FROM assets WHERE serial_number = 'SN126'"""),
    ("== Q11  My team: direct reports of a manager (ix_employees_reporting_manager)",
     """SELECT emp_id, first_name, last_name FROM employees
WHERE reporting_manager_id = md5('emp'||3)::uuid AND status = 'Active' ORDER BY last_name"""),
    ("== Q12  Sign-in: an employee by official email, any capitals (uq_employees_official_email)",
     """SELECT id, status FROM employees WHERE lower(official_email) = lower('EMP77@example.com')"""),
    ("== Q13  Sign-in: live access grants of one employee (uq_employee_access_grants_one_active)",
     """SELECT g.module_id, g.submodule_id, g.access_level FROM employee_access_grants g
WHERE g.employee_id = md5('emp'||7)::uuid AND g.revoked_at IS NULL"""),
    ("== Q14  Staffing search: active employees with a skill (ix_employee_skills_skill)",
     """SELECT e.emp_id, e.first_name, s.proficiency FROM employee_skills s JOIN employees e ON e.id = s.employee_id
WHERE s.skill_id = md5('skl'||5)::uuid AND e.status = 'Active'"""),
]


async def main():
    await build(DB)
    conn = await connect(DB)
    await conn.execute((HERE / "seed.sql").read_text())
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
