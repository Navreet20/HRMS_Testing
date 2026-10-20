-- Seed data for the EXPLAIN checks. Loaded into the throwaway database hrms_perf only.
-- Scale: 500 employees (10 managers), 5,000 assets, ~18,000 assignments, 100,000 activity_log rows,
-- 50,000 email_deliveries rows, 40 skills, ~1,500 employee skills, ~2,000 access grants.
-- Ids are made with md5(...)::uuid so the queries can name them (md5('emp'||7)::uuid is employee 7).

INSERT INTO locations (id, name, address_line_1, timezone)
SELECT md5('loc' || i)::uuid, 'Location ' || i, '1 Main St', 'UTC' FROM generate_series(1, 5) i;
INSERT INTO departments (id, name) SELECT md5('dep' || i)::uuid, 'Dept ' || i FROM generate_series(1, 20) i;
INSERT INTO designations (id, name) SELECT md5('des' || i)::uuid, 'Designation ' || i FROM generate_series(1, 30) i;
INSERT INTO leave_types (id, name, is_unlimited)
SELECT md5('lt' || i)::uuid, 'Leave type ' || i, i = 6 FROM generate_series(1, 6) i;
INSERT INTO leave_policies (id, name, start_year, end_year)
SELECT md5('pol' || i)::uuid, 'Policy ' || i, 2022 + i, 2022 + i FROM generate_series(1, 4) i;
INSERT INTO leave_policy_lines (leave_policy_id, leave_type_id, days_allowed)
SELECT md5('pol' || p)::uuid, md5('lt' || t)::uuid, 10 + t FROM generate_series(1, 4) p, generate_series(1, 5) t;
INSERT INTO companies (name, company_type, asset_code_prefix, location_id)
VALUES ('Cognivance', 'LLC', 'COG', md5('loc1')::uuid);

-- employees 1-10 are the managers; everyone else reports to one of them. 1 in 10 is Inactive.
INSERT INTO employees (id, first_name, last_name, status, official_email, leave_policy_id, department_id, location_id,
                       designation_id, employment_type, work_mode, date_of_joining, role, reporting_manager_id)
SELECT md5('emp' || i)::uuid, 'First' || i, 'Last' || i, CASE WHEN i % 10 = 0 AND i > 10 THEN 'Inactive' ELSE 'Active' END,
       'emp' || i || '@example.com', md5('pol' || (1 + i % 4))::uuid, md5('dep' || (1 + i % 20))::uuid,
       md5('loc' || (1 + i % 5))::uuid, md5('des' || (1 + i % 30))::uuid, 'Full-time', 'Hybrid',
       date '2020-01-01' + i, CASE WHEN i <= 10 THEN 'Manager' ELSE 'Employee' END,
       CASE WHEN i > 10 THEN md5('emp' || (1 + i % 10))::uuid END
FROM generate_series(1, 500) i;

INSERT INTO skills (id, name) SELECT md5('skl' || i)::uuid, 'Skill ' || i FROM generate_series(1, 40) i;
-- three skills per employee
INSERT INTO employee_skills (employee_id, skill_id, proficiency, years_experience)
SELECT md5('emp' || i)::uuid, md5('skl' || (1 + (i * 3 + k * 7) % 40))::uuid, 'Intermediate', k
FROM generate_series(1, 500) i, generate_series(1, 3) k;

INSERT INTO modules (id, module_key, display_name, display_order)
SELECT i, 'module' || i, 'Module ' || i, i FROM generate_series(1, 6) i;
-- three live grants per employee, plus one revoked (history) grant each
INSERT INTO employee_access_grants (employee_id, module_id, access_level, granted_by_employee_id)
SELECT md5('emp' || i)::uuid, k, 'View', md5('emp1')::uuid FROM generate_series(1, 500) i, generate_series(1, 3) k;
INSERT INTO employee_access_grants (employee_id, module_id, access_level, granted_by_employee_id, granted_at,
                                    revoked_at, revoked_by_employee_id)
SELECT md5('emp' || i)::uuid, 4, 'Edit', md5('emp1')::uuid, now() - interval '30 days', now() - interval '1 day',
       md5('emp1')::uuid
FROM generate_series(1, 500) i;

INSERT INTO asset_categories (id, name, is_serial_required, has_low_stock_tracking)
SELECT md5('cat' || i)::uuid, 'Category ' || i, i <= 2, i <= 2 FROM generate_series(1, 6) i;
INSERT INTO asset_category_os_platforms (asset_category_id, os_platform)
VALUES (md5('cat1')::uuid, 'Mac'), (md5('cat1')::uuid, 'Windows'), (md5('cat2')::uuid, 'iOS'), (md5('cat2')::uuid, 'Android');

INSERT INTO assets (id, asset_code, asset_category_id, serial_number, os_platform, status, purchase_date)
SELECT md5('ast' || i)::uuid, 'COG-' || lpad(i::text, 5, '0'), md5('cat' || (1 + i % 6))::uuid,
       CASE WHEN i % 6 IN (0, 1) THEN 'SN' || i END,
       CASE WHEN i % 6 = 0 THEN 'Mac' WHEN i % 6 = 1 THEN 'iOS' END,
       CASE WHEN i <= 3000 THEN 'Assigned' WHEN i <= 4500 THEN 'In Stock' WHEN i <= 4800 THEN 'Under Repair'
            WHEN i <= 4900 THEN 'Lost' ELSE 'Decommissioned' END,
       date '2023-01-01' + (i % 700)
FROM generate_series(1, 5000) i;

-- three closed assignments per asset
INSERT INTO asset_assignments (asset_id, assigned_to_employee_id, assigned_date, returned_date, return_reason, condition_at_return)
SELECT md5('ast' || i)::uuid, md5('emp' || (1 + (i * 7 + k * 13) % 500))::uuid,
       date '2023-01-01' + (k - 1) * 200 + i % 50, date '2023-01-01' + (k - 1) * 200 + i % 50 + 100, 'Upgrade', 'Good'
FROM generate_series(1, 5000) i, generate_series(1, 3) k;
-- one open assignment for each asset that is Assigned
INSERT INTO asset_assignments (asset_id, assigned_to_employee_id, assigned_date)
SELECT md5('ast' || i)::uuid, md5('emp' || (1 + (i * 11) % 500))::uuid, date '2025-06-01' + i % 100
FROM generate_series(1, 3000) i;

-- oldest rows first, so the table's physical order follows time like the real log
INSERT INTO activity_log (occurred_at, actor_employee_id, action, entity_type, entity_id, details)
SELECT now() - (i || ' minutes')::interval, md5('emp' || (1 + i % 500))::uuid, 'updated',
       CASE WHEN i % 2 = 0 THEN 'asset' ELSE 'employee' END,
       CASE WHEN i % 2 = 0 THEN md5('ast' || (1 + i % 5000))::uuid ELSE md5('emp' || (1 + i % 500))::uuid END,
       '{"field":{"old":"a","new":"b"}}'::jsonb
FROM generate_series(100000, 1, -1) i;

INSERT INTO email_deliveries (event_key, to_email, subject, body, status, attempts, next_attempt_at, sent_at, created_at)
SELECT 'asset_assigned', 'user' || i || '@example.com', 'Subject ' || i, 'Body ' || i,
       CASE WHEN i % 1700 = 0 THEN 'pending' WHEN i % 500 = 0 THEN 'failed' ELSE 'sent' END,
       CASE WHEN i % 500 = 0 THEN 6 ELSE 1 END,
       CASE WHEN i % 1700 = 0 THEN now() - interval '1 minute' END,
       CASE WHEN i % 1700 <> 0 AND i % 500 <> 0 THEN now() - (i || ' minutes')::interval END,
       now() - (i || ' minutes')::interval
FROM generate_series(50000, 1, -1) i;

INSERT INTO company_holidays (holiday_date, name, holiday_type)
SELECT date '2025-01-01' + i * 12, 'Holiday ' || i, 'Company Holiday' FROM generate_series(0, 59) i;

ANALYZE;
