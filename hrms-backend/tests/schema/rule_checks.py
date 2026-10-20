"""Rule checks for the schema defined by the models in app/models.

Builds a throwaway database named hrms_test from the models, runs the checks, and drops it. Run: python3 rule_checks.py

Three kinds of check (errors are read with asyncpg, which gives the name of the constraint that refused the row):
  refuse(...)  the statement must be refused, AND the error must name the constraint we expect.
               A refusal for any other reason (typo, wrong column, another rule) is a FAIL.
  accept(...)  the statement must succeed and must change at least one row.
  default(...) a query must return exactly the expected value (default values).

Checks run in order and share state: later checks use rows that earlier checks created.
"""
import asyncio

import asyncpg

from dbtools import build, connect, drop_database

DB = "hrms_test"
loop = asyncio.new_event_loop()


def run(coro):
    return loop.run_until_complete(coro)


run(build(DB))
conn = run(connect(DB))


def setup(sql):
    """Run setup statements (not counted as checks); stop at the first error."""
    run(conn.execute(sql))


results = []


def record(ok, name, detail=""):
    results.append(("PASS" if ok else "FAIL", name, "" if ok else detail))


def attempt(sql):
    """Send one statement. Returns (database error or None, status text such as 'UPDATE 1')."""
    try:
        return None, run(conn.execute(sql))
    except asyncpg.PostgresError as e:
        return e, None


def fired(err, expected):
    """True if the error names one of the expected constraints (or a not-null on a column)."""
    for e in (expected if isinstance(expected, (tuple, list)) else (expected,)):
        if e.startswith("notnull:"):
            if isinstance(err, asyncpg.NotNullViolationError) and err.column_name == e.split(":", 1)[1]:
                return True
        elif e.startswith("msg:"):
            if e[4:] in str(err):
                return True
        elif getattr(err, "constraint_name", None) == e:
            return True
    return False


def refuse(name, sql, expected):
    err, _ = attempt(sql)
    if err is None:
        record(False, name, "unexpectedly accepted")
    elif fired(err, expected):
        record(True, name)
    else:
        record(False, name, f"refused, but not by {expected}: {type(err).__name__} {err.constraint_name} {err}")


def accept(name, sql):
    err, status = attempt(sql)
    if err is not None:
        record(False, name, f"refused: {err}")
    elif "UPDATE 0" in status or "DELETE 0" in status:
        record(False, name, "accepted but changed no rows")
    else:
        record(True, name)


def default(name, sql, expected):
    try:
        out = str(run(conn.fetchval(sql)))
        record(out == expected, name, f"got {out!r}, expected {expected!r}")
    except asyncpg.PostgresError as e:
        record(False, name, str(e))


# ---------------------------------------------------------------- setup (not counted)
setup("""INSERT INTO employees(id,first_name,last_name) VALUES ('00000000-0000-0000-0000-000000000001','Ann','One'),('00000000-0000-0000-0000-000000000002','Ben','Two'),('00000000-0000-0000-0000-000000000003','Cy','Three');
INSERT INTO locations(name,address_line_1,timezone) VALUES ('Dallas','1 Main','America/Chicago');
INSERT INTO leave_types(name,is_unlimited) VALUES ('Annual',false),('Unpaid',true);
INSERT INTO leave_policies(name,start_year,end_year) VALUES ('Std',2026,2026);
INSERT INTO asset_categories(name,is_serial_required,has_low_stock_tracking) VALUES ('Laptop',true,true),('Mouse',false,false);
INSERT INTO asset_category_os_platforms SELECT id,'Mac' FROM asset_categories WHERE name='Laptop';
INSERT INTO asset_category_os_platforms SELECT id,'Windows' FROM asset_categories WHERE name='Laptop';
INSERT INTO departments(name) VALUES ('Finance');
INSERT INTO departments(name,parent_department_id,head_employee_id) VALUES ('Payroll Support',(SELECT id FROM departments WHERE name='Finance'),'00000000-0000-0000-0000-000000000003');""")
E1 = "'00000000-0000-0000-0000-000000000001'"
E2 = "'00000000-0000-0000-0000-000000000002'"
E3 = "'00000000-0000-0000-0000-000000000003'"
LAP = "(SELECT id FROM asset_categories WHERE name='Laptop')"
MOU = "(SELECT id FROM asset_categories WHERE name='Mouse')"
POL = "(SELECT id FROM leave_policies LIMIT 1)"

# ---------------------------------------------------------------- locations / departments / names
refuse("location name duplicate ignoring case", "INSERT INTO locations(name,address_line_1,timezone) VALUES ('DALLAS','x','UTC')", "uq_locations_name")
accept("location without city/state/zip allowed", "INSERT INTO locations(name,address_line_1,timezone,country_code) VALUES ('Tokyo','x','Asia/Tokyo','JP')")
refuse("department name duplicate ignoring case", "INSERT INTO departments(name) VALUES ('finance')", "uq_departments_name")
PAY = "(SELECT id FROM departments WHERE name='Payroll Support')"
refuse("department loop: a parent moved under its own child", f"UPDATE departments SET parent_department_id={PAY} WHERE name='Finance'", "msg:cannot be placed under itself")
accept("department: a grandchild is allowed", f"INSERT INTO departments(name,parent_department_id) VALUES ('Payroll Tax',{PAY})")
refuse("department loop: a parent moved under its own grandchild", "UPDATE departments SET parent_department_id=(SELECT id FROM departments WHERE name='Payroll Tax') WHERE name='Finance'", "msg:cannot be placed under itself")
accept("department: a sub-department can move to the top level", "UPDATE departments SET parent_department_id=NULL WHERE name='Payroll Tax'")
refuse("department own parent", "UPDATE departments SET parent_department_id=id WHERE name='Finance'", "ck_departments_not_own_parent")
accept("designation valid", "INSERT INTO designations(name) VALUES ('Engineer')")
refuse("designation duplicate ignoring case", "INSERT INTO designations(name) VALUES ('ENGINEER')", "uq_designations_name")
refuse("leave type duplicate ignoring case", "INSERT INTO leave_types(name) VALUES ('annual')", "uq_leave_types_name")
# ---------------------------------------------------------------- company
refuse("company bad type", "INSERT INTO companies(name,company_type,asset_code_prefix) VALUES ('A','Nope','COG')", "ck_companies_company_type")
refuse("company bad weekday", "INSERT INTO companies(name,company_type,asset_code_prefix,timesheet_reminder_weekday) VALUES ('A','LLC','COG',9)", "ck_companies_reminder_weekday")
refuse("company bad hours format", "INSERT INTO companies(name,company_type,asset_code_prefix,timesheet_hours_format) VALUES ('A','LLC','COG','x')", "ck_companies_hours_format")
accept("company valid", "INSERT INTO companies(name,company_type,asset_code_prefix,location_id) VALUES ('Cog','LLC','COG',(SELECT id FROM locations LIMIT 1))")
refuse("company: a second company row", "INSERT INTO companies(name,company_type,asset_code_prefix) VALUES ('Second','LLC','SEC')", "uq_companies_single_row")
# ---------------------------------------------------------------- leave policies and lines
refuse("policy end before start", "INSERT INTO leave_policies(name,start_year,end_year) VALUES ('Bad',2026,2025)", "ck_leave_policies_years")
refuse("policy duplicate name+years ignoring case", "INSERT INTO leave_policies(name,start_year,end_year) VALUES ('STD',2026,2026)", "uq_leave_policies_name_period")
accept("policy same name other years allowed", "INSERT INTO leave_policies(name,start_year,end_year) VALUES ('Std',2027,2027)")
L = lambda t: f"(SELECT id FROM leave_types WHERE name='{t}')"
accept("line valid with rollover", f"INSERT INTO leave_policy_lines(leave_policy_id,leave_type_id,days_allowed,rollover_allowed,max_rollover_days) VALUES ({POL},{L('Annual')},20,true,5)")
refuse("line duplicate type in policy", f"INSERT INTO leave_policy_lines(leave_policy_id,leave_type_id,days_allowed) VALUES ({POL},{L('Annual')},10)", "uq_leave_policy_lines_policy_type")
accept("line unlimited with no days allowed", f"INSERT INTO leave_policy_lines(leave_policy_id,leave_type_id) VALUES ({POL},{L('Unpaid')})")
P2 = "(SELECT id FROM leave_policies WHERE start_year=2027)"
refuse("line days not half step", f"INSERT INTO leave_policy_lines(leave_policy_id,leave_type_id,days_allowed) VALUES ({P2},{L('Annual')},10.3)", "ck_leave_policy_lines_days")
refuse("line negative days", f"INSERT INTO leave_policy_lines(leave_policy_id,leave_type_id,days_allowed) VALUES ({P2},{L('Annual')},-1)", "ck_leave_policy_lines_days")
refuse("line rollover without max", f"INSERT INTO leave_policy_lines(leave_policy_id,leave_type_id,days_allowed,rollover_allowed) VALUES ({P2},{L('Annual')},10,true)", "ck_leave_policy_lines_rollover")
refuse("line max rollover above days", f"INSERT INTO leave_policy_lines(leave_policy_id,leave_type_id,days_allowed,rollover_allowed,max_rollover_days) VALUES ({P2},{L('Annual')},10,true,12)", "ck_leave_policy_lines_rollover")
refuse("line max rollover without rollover", f"INSERT INTO leave_policy_lines(leave_policy_id,leave_type_id,days_allowed,rollover_allowed,max_rollover_days) VALUES ({P2},{L('Annual')},10,false,2)", "ck_leave_policy_lines_rollover")
refuse("line rollover with no days", f"INSERT INTO leave_policy_lines(leave_policy_id,leave_type_id,rollover_allowed,max_rollover_days) VALUES ({P2},{L('Unpaid')},true,2)", "ck_leave_policy_lines_rollover")
# ---------------------------------------------------------------- holidays
accept("holiday valid", "INSERT INTO company_holidays(holiday_date,name,holiday_type) VALUES ('2026-12-25','Christmas','Federal Holiday')")
accept("two holidays same date different name", "INSERT INTO company_holidays(holiday_date,name,holiday_type) VALUES ('2026-12-25','Foundation Day','Company Holiday')")
refuse("same holiday name same date ignoring case", "INSERT INTO company_holidays(holiday_date,name,holiday_type) VALUES ('2026-12-25','CHRISTMAS','Other')", "uq_company_holidays_date_name")
refuse("holiday bad type", "INSERT INTO company_holidays(holiday_date,name,holiday_type) VALUES ('2026-12-26','X','Nope')", "ck_company_holidays_type")
# ---------------------------------------------------------------- email
refuse("email bad status", "INSERT INTO email_deliveries(event_key,to_email,subject,body,status) VALUES ('e','a@b.c','s','b','weird')", "ck_email_deliveries_status")
refuse("email more than 6 attempts", "INSERT INTO email_deliveries(event_key,to_email,subject,body,attempts) VALUES ('e','a@b.c','s','b',7)", "ck_email_deliveries_attempts")
refuse("email negative attempts", "INSERT INTO email_deliveries(event_key,to_email,subject,body,attempts) VALUES ('e','a@b.c','s','b',-1)", "ck_email_deliveries_attempts")
accept("email exactly 6 attempts allowed", "INSERT INTO email_deliveries(event_key,to_email,subject,body,attempts,status) VALUES ('e6','a@b.c','s','b',6,'failed')")
refuse("email sent without a sent time", "INSERT INTO email_deliveries(event_key,to_email,subject,body,status) VALUES ('e','a@b.c','s','b','sent')", "ck_email_deliveries_sent_at")
refuse("email pending with a sent time", "INSERT INTO email_deliveries(event_key,to_email,subject,body,sent_at) VALUES ('e','a@b.c','s','b',now())", "ck_email_deliveries_sent_at")
refuse("email pending without a next attempt time", "INSERT INTO email_deliveries(event_key,to_email,subject,body,next_attempt_at) VALUES ('e','a@b.c','s','b',NULL)", "ck_email_deliveries_pending_due")
accept("email sent with a sent time", "INSERT INTO email_deliveries(event_key,to_email,subject,body,status,sent_at,next_attempt_at) VALUES ('es','a@b.c','s','b','sent',now(),NULL)")
accept("email valid", "INSERT INTO email_deliveries(event_key,to_email,subject,body) VALUES ('e','a@b.c','s','b')")
# ---------------------------------------------------------------- assets
A = lambda code, cat, extra="", vals="": f"INSERT INTO assets(asset_code,asset_category_id{extra}) VALUES ('{code}',{cat}{vals})"
accept("asset valid with OS Mac", A("COG-00001", LAP, ",serial_number,os_platform", ",'SN1','Mac'"))
refuse("asset duplicate code", A("COG-00001", MOU), "uq_assets_asset_code")
refuse("asset duplicate serial", A("COG-00002", LAP, ",serial_number", ",'SN1'"), "uq_assets_serial_number")
accept("asset two without serial allowed", A("COG-00003", MOU) + "; " + A("COG-00004", MOU))
refuse("asset OS not allowed for category (iOS on Laptop)", A("COG-00005", LAP, ",os_platform", ",'iOS'"), "fk_assets_category_os")
refuse("asset OS on category with none (Mouse+Mac)", A("COG-00006", MOU, ",os_platform", ",'Mac'"), "fk_assets_category_os")
refuse("asset bad condition", A("COG-00007", MOU, ",condition", ",'Great'"), "ck_assets_condition")
refuse("asset bad status", A("COG-00008", MOU, ",status", ",'Gone'"), "ck_assets_status")
refuse("asset warranty before purchase", A("COG-00009", MOU, ",purchase_date,warranty_expiry", ",'2026-05-01','2026-01-01'"), "ck_assets_warranty_dates")
refuse("asset warranty plan number without type", A("COG-00010", MOU, ",warranty_plan_number", ",'123'"), "ck_assets_warranty_plan_number")
accept("asset warranty plan type with number", A("COG-00011", MOU, ",warranty_plan_type,warranty_plan_number", ",'Dell ProSupport','123'"))
refuse("asset bad warranty plan type", A("COG-00012", MOU, ",warranty_plan_type", ",'Gold'"), "ck_assets_warranty_plan_type")
refuse("asset bad OS value (Linux)", A("COG-00013", LAP, ",os_platform", ",'Linux'"), "fk_assets_category_os")
accept("asset code sequence works", "SELECT nextval('asset_number_seq')")
# bad OS value in the category table
refuse("allowed-OS table refuses a bad OS value (Linux)", "INSERT INTO asset_category_os_platforms SELECT id,'Linux' FROM asset_categories WHERE name='Laptop'", "ck_asset_category_os_platform")
refuse("allowed-OS table refuses the same OS twice", "INSERT INTO asset_category_os_platforms SELECT id,'Mac' FROM asset_categories WHERE name='Laptop'", "asset_category_os_platforms_pkey")
refuse("allowed-OS table refuses an unknown category", "INSERT INTO asset_category_os_platforms VALUES (gen_random_uuid(),'Mac')", "fk_asset_category_os_platforms_asset_category_id")
# ---------------------------------------------------------------- assignments
AS = "(SELECT id FROM assets WHERE asset_code='COG-00001')"
AS2 = "(SELECT id FROM assets WHERE asset_code='COG-00003')"
ins = lambda a, e, d, extra="", vals="": f"INSERT INTO asset_assignments(asset_id,assigned_to_employee_id,assigned_date{extra}) VALUES ({a},{e},'{d}'{vals})"
accept("assignment open valid", ins(AS, E1, "2026-01-10"))
refuse("second open assignment same asset refused", ins(AS, E2, "2026-01-11"), "uq_asset_assignments_one_open")
accept("employee holds many assets", ins(AS2, E1, "2026-01-10"))
refuse("return before assigned date refused", "UPDATE asset_assignments SET returned_date='2026-01-05',return_reason='Broken',condition_at_return='Poor' WHERE asset_id=" + AS, "ck_asset_assignments_dates")
refuse("return without reason refused", "UPDATE asset_assignments SET returned_date='2026-01-20' WHERE asset_id=" + AS, "ck_asset_assignments_open_or_closed")
refuse("return Other without note refused", "UPDATE asset_assignments SET returned_date='2026-01-20',return_reason='Other',condition_at_return='Good' WHERE asset_id=" + AS, "ck_asset_assignments_other_note")
refuse("return without condition refused", "UPDATE asset_assignments SET returned_date='2026-01-20',return_reason='Broken' WHERE asset_id=" + AS, "ck_asset_assignments_condition_needed")
refuse("reason without return date refused", "UPDATE asset_assignments SET return_reason='Broken' WHERE asset_id=" + AS, "ck_asset_assignments_open_or_closed")
refuse("bad return_reason value refused", "UPDATE asset_assignments SET returned_date='2026-03-01',return_reason='Weird',condition_at_return='Good' WHERE asset_id=" + AS2, "ck_asset_assignments_reason_values")
refuse("bad condition_at_return value refused", "UPDATE asset_assignments SET returned_date='2026-03-01',return_reason='Broken',condition_at_return='Weird' WHERE asset_id=" + AS2, "ck_asset_assignments_condition_values")
refuse("assignment to an unknown employee refused", ins("(SELECT id FROM assets WHERE asset_code='COG-00004')", "gen_random_uuid()", "2026-01-12"), "fk_asset_assignments_assigned_to_employee_id")
refuse("assignment of an unknown asset refused", ins("gen_random_uuid()", E1, "2026-01-12"), "fk_asset_assignments_asset_id")
accept("return Broken with condition ok", "UPDATE asset_assignments SET returned_date='2026-01-20',return_reason='Broken',condition_at_return='Poor' WHERE asset_id=" + AS)
accept("reassign after return ok", ins(AS, E2, "2026-02-01"))
refuse("lost with a condition refused", "UPDATE asset_assignments SET returned_date='2026-02-05',return_reason='Lost',condition_at_return='Good' WHERE assigned_to_employee_id=" + E2, "ck_asset_assignments_condition_needed")
accept("lost without condition ok", "UPDATE asset_assignments SET returned_date='2026-02-05',return_reason='Lost' WHERE assigned_to_employee_id=" + E2)
# ---------------------------------------------------------------- activity log
accept("activity log valid system row", "INSERT INTO activity_log(action,entity_type,entity_id,details) VALUES ('created','asset',gen_random_uuid(),'{\"a\":{\"old\":1,\"new\":2}}')")
refuse("activity log details too large (over 4 KB)", "INSERT INTO activity_log(action,entity_type,entity_id,details) VALUES ('created','asset',gen_random_uuid(),jsonb_build_object('blob',repeat('x',5000)))", "ck_activity_log_details_size")
refuse("activity log needs action", "INSERT INTO activity_log(entity_type,entity_id) VALUES ('asset',gen_random_uuid())", "notnull:action")
refuse("activity log needs entity_type", "INSERT INTO activity_log(action,entity_id) VALUES ('created',gen_random_uuid())", "notnull:entity_type")
refuse("activity log needs entity_id", "INSERT INTO activity_log(action,entity_type) VALUES ('created','asset')", "notnull:entity_id")
refuse("activity log unknown actor refused", "INSERT INTO activity_log(action,entity_type,entity_id,actor_employee_id) VALUES ('created','asset',gen_random_uuid(),gen_random_uuid())", "fk_activity_log_actor_employee_id")
# ---------------------------------------------------------------- employees
# Own department, designation and location (Tokyo), so the delete checks further down are not affected.
accept("setup: a department for employees", "INSERT INTO departments(name) VALUES ('Engineering')")
accept("setup: a designation for employees", "INSERT INTO designations(name) VALUES ('Analyst')")
E4 = "'00000000-0000-0000-0000-000000000004'"
E5, E6, E7 = ("'00000000-0000-0000-0000-00000000000%d'" % n for n in (5, 6, 7))


def emp(**over):
    """INSERT of a complete Active employee; keyword arguments replace a value (SQL text) or drop it (None)."""
    v = dict(first_name="'Dee'", last_name="'Four'", status="'Active'", official_email="'dee@x.com'",
             department_id="(SELECT id FROM departments WHERE name='Engineering')",
             designation_id="(SELECT id FROM designations WHERE name='Analyst')",
             location_id="(SELECT id FROM locations WHERE name='Tokyo')", employment_type="'Full-time'",
             work_mode="'Hybrid'", date_of_joining="'2026-01-05'", role="'Employee'")
    v.update(over)
    v = {k: x for k, x in v.items() if x is not None}
    return f"INSERT INTO employees({','.join(v)}) VALUES ({','.join(v.values())})"


accept("employee: a complete Active employee", emp(id=E4))
accept("employee: a Draft needs only a name", "INSERT INTO employees(first_name,last_name) VALUES ('Fay','Draft')")
refuse("employee: Active without a department", emp(official_email="'a1@x.com'", department_id=None), "ck_employees_complete_unless_draft")
refuse("employee: New without a joining date", emp(official_email="'a2@x.com'", status="'New'", date_of_joining=None), "ck_employees_complete_unless_draft")
accept("employee: Pending with a future joining date", emp(official_email="'p1@x.com'", status="'Pending'", date_of_joining="'2099-01-01'"))
refuse("employee: Pending without a joining date", emp(official_email="'p2@x.com'", status="'Pending'", date_of_joining=None), "ck_employees_complete_unless_draft")
refuse("employee: official email duplicate ignoring case", emp(official_email="'DEE@X.COM'"), "uq_employees_official_email")
refuse("employee: bad status", emp(official_email="'a3@x.com'", status="'Gone'"), "ck_employees_status")
refuse("employee: bad work mode", emp(official_email="'a4@x.com'", work_mode="'Office'"), "ck_employees_work_mode")
refuse("employee: bad employment type", emp(official_email="'a5@x.com'", employment_type="'Temp'"), "ck_employees_employment_type")
refuse("employee: bad role", emp(official_email="'a6@x.com'", role="'Boss'"), "ck_employees_role")
refuse("employee: bad gender", emp(official_email="'a7@x.com'", gender="'X'"), "ck_employees_gender")
refuse("employee: bad marital status", emp(official_email="'a8@x.com'", marital_status="'Engaged'"), "ck_employees_marital_status")
refuse("employee: phone not in +E.164 form", emp(official_email="'a9@x.com'", phone_number="'555-1234'"), "ck_employees_phone")
refuse("employee: alternate phone not in +E.164 form", emp(official_email="'b1@x.com'", alternate_phone_number="'0044 20'"), "ck_employees_alternate_phone")
accept("employee: phone in +E.164 form", f"UPDATE employees SET phone_number='+14155550123' WHERE id={E4}")
refuse("employee: nationality code not two capitals", emp(official_email="'b2@x.com'", nationality_code="'us'"), "ck_employees_nationality_code")
refuse("employee: payroll start before joining", emp(official_email="'b3@x.com'", payroll_start_date="'2025-12-01'"), "ck_employees_dates")
refuse("employee: born after joining", emp(official_email="'b4@x.com'", date_of_birth="'2027-01-01'"), "ck_employees_dates")
accept("employee: payroll start on the joining date", f"UPDATE employees SET payroll_start_date='2026-01-05' WHERE id={E4}")
accept("employee code set", f"UPDATE employees SET employee_code='C-1' WHERE id={E1}")
refuse("employee code duplicate", f"UPDATE employees SET employee_code='C-1' WHERE id={E2}", "uq_employees_employee_code")
# national ID
NID = "(SELECT id FROM national_id_document_types WHERE document_type_code='SSN')"
accept("national ID type valid", "INSERT INTO national_id_document_types(document_type_code,document_type_label,country_code,number_format) VALUES ('SSN','Social Security Number','US','^[0-9]{9}$')")
refuse("national ID type duplicate code", "INSERT INTO national_id_document_types(document_type_code,document_type_label,country_code) VALUES ('SSN','Other','US')", "uq_national_id_document_types_code")
refuse("national ID type country not two capitals", "INSERT INTO national_id_document_types(document_type_code,document_type_label,country_code) VALUES ('X','X','us')", "ck_national_id_document_types_country")
refuse("employee: national ID last 4 without the rest", f"UPDATE employees SET national_id_last4='6789' WHERE id={E4}", "ck_employees_national_id_together")
refuse("employee: national ID type without the number", f"UPDATE employees SET national_id_document_type_id={NID} WHERE id={E4}", "ck_employees_national_id_together")
refuse("employee: national ID last 4 with a symbol", f"UPDATE employees SET national_id_document_type_id={NID},national_id_number_encrypted='enc',national_id_last4='67-9' WHERE id={E4}", "ck_employees_national_id_last4")
accept("employee: national ID type, encrypted number and last 4 together", f"UPDATE employees SET national_id_document_type_id={NID},national_id_number_encrypted='enc',national_id_last4='6789' WHERE id={E4}")
# emp_id and delete (trigger trg_employees_guard)
default("employee: emp_id generated from the sequence", f"SELECT emp_id FROM employees WHERE id={E1}", "EMP-00001")
refuse("employee: emp_id cannot be supplied on insert", "INSERT INTO employees(first_name,last_name,emp_id) VALUES ('X','Y','EMP-00007')", "msg:emp_id is generated by the database")
refuse("employee: emp_id cannot be changed", f"UPDATE employees SET emp_id='EMP-99999' WHERE id={E4}", "msg:emp_id cannot be changed")
accept("employee: other columns can still be changed", f"UPDATE employees SET work_mode='Remote' WHERE id={E4}")
refuse("employee: an Active employee cannot be deleted", f"DELETE FROM employees WHERE id={E4}", "msg:employees are never deleted")
accept("employee: a Draft can be deleted", "DELETE FROM employees WHERE first_name='Fay'")
# reporting line (trigger trg_employees_no_manager_loop)
accept("setup: three more Draft employees", f"INSERT INTO employees(id,first_name,last_name) VALUES ({E5},'E','5'),({E6},'E','6'),({E7},'E','7')")
refuse("employee: own manager", f"UPDATE employees SET reporting_manager_id=id WHERE id={E5}", "ck_employees_not_own_manager")
accept("employee: 6 reports to 5", f"UPDATE employees SET reporting_manager_id={E5} WHERE id={E6}")
refuse("manager loop: 5 reports to 6", f"UPDATE employees SET reporting_manager_id={E6} WHERE id={E5}", "msg:cannot report to themselves")
accept("employee: 7 reports to 6", f"UPDATE employees SET reporting_manager_id={E6} WHERE id={E7}")
refuse("manager loop: 5 reports to 7 (two levels down)", f"UPDATE employees SET reporting_manager_id={E7} WHERE id={E5}", "msg:cannot report to themselves")
accept("employee: a manager can be removed", f"UPDATE employees SET reporting_manager_id=NULL WHERE id={E7}")
refuse("employee: an unknown manager", f"UPDATE employees SET reporting_manager_id=gen_random_uuid() WHERE id={E7}", "fk_employees_reporting_manager_id")
# ---------------------------------------------------------------- addresses
ADDR = "INSERT INTO addresses(employee_id,address_line_1,city{}) VALUES ({},'1 Main','Austin'{})"
accept("address valid", ADDR.format("", E4, ""))
refuse("address: a second one for the same employee", ADDR.format("", E4, ""), "uq_addresses_employee")
refuse("address: country code not two capitals", ADDR.format(",country_code", E5, ",'us'"), "ck_addresses_country")
# ---------------------------------------------------------------- emergency contacts
EC = lambda order, rel="Spouse", phone="+14155550100": f"INSERT INTO emergency_contacts(employee_id,contact_order,name,relation,phone_number) VALUES ({E4},{order},'Kim','{rel}','{phone}')"
accept("emergency contact 1", EC(1))
accept("emergency contact 2", EC(2, "Parent"))
refuse("emergency contact: a third one", EC(3), "ck_emergency_contacts_order")
refuse("emergency contact: order 1 twice", EC(1, "Sibling"), "uq_emergency_contacts_employee_order")
refuse("emergency contact: bad relation", f"INSERT INTO emergency_contacts(employee_id,contact_order,name,relation,phone_number) VALUES ({E5},1,'Kim','Boss','+14155550100')", "ck_emergency_contacts_relation")
refuse("emergency contact: bad phone", f"INSERT INTO emergency_contacts(employee_id,contact_order,name,relation,phone_number) VALUES ({E5},1,'Kim','Spouse','12345')", "ck_emergency_contacts_phone")
# ---------------------------------------------------------------- onboarding packet documents
DOC = lambda version, key, kind="Offer Letter": f"INSERT INTO employee_onboarding_packet_documents(employee_id,document_type,version_number,file_key,uploaded_by_employee_id) VALUES ({E4},'{kind}',{version},'{key}',{E1})"
accept("onboarding document version 1", DOC(1, "k1"))
accept("onboarding document version 2 of the same type", DOC(2, "k2"))
refuse("onboarding document: same type and version twice", DOC(2, "k3"), "uq_onboarding_documents_employee_type_version")
refuse("onboarding document: same file key twice", DOC(3, "k1"), "uq_onboarding_documents_file_key")
refuse("onboarding document: version 0", DOC(0, "k4"), "ck_onboarding_documents_version")
refuse("onboarding document: bad type", DOC(1, "k5", "Resume"), "ck_onboarding_documents_type")
# ---------------------------------------------------------------- skills
SK = lambda name: f"(SELECT id FROM skills WHERE name='{name}')"
ES = lambda skill, cols="", vals="": f"INSERT INTO employee_skills(employee_id,skill_id{cols}) VALUES ({E4},{SK(skill)}{vals})"
accept("skill valid", "INSERT INTO skills(name) VALUES ('Python'),('SQL')")
refuse("skill name duplicate ignoring case", "INSERT INTO skills(name) VALUES ('PYTHON')", "uq_skills_name")
accept("employee skill valid with certificate", ES("Python", ",proficiency,years_experience,certificate_name,certificate_expires_on", ",'Advanced',5,'PCAP','2027-01-01'"))
refuse("employee skill: same skill twice", ES("Python"), "uq_employee_skills_employee_skill")
refuse("employee skill: 99 years", ES("SQL", ",years_experience", ",99"), "ck_employee_skills_years")
refuse("employee skill: bad proficiency", ES("SQL", ",proficiency", ",'Guru'"), "ck_employee_skills_proficiency")
refuse("employee skill: certificate expiry without a certificate", ES("SQL", ",certificate_expires_on", ",'2027-01-01'"), "ck_employee_skills_certificate")
# ---------------------------------------------------------------- RBAC
accept("modules valid", "INSERT INTO modules(id,module_key,display_name,display_order) VALUES (1,'employees','Employees',1),(2,'assets','Assets',2)")
refuse("module key duplicate", "INSERT INTO modules(id,module_key,display_name,display_order) VALUES (3,'employees','X',3)", "uq_modules_key")
refuse("module key with a space", "INSERT INTO modules(id,module_key,display_name,display_order) VALUES (3,'Bad Key','X',3)", "ck_modules_key")
refuse("module key in snake_case", "INSERT INTO modules(id,module_key,display_name,display_order) VALUES (3,'activity_log','X',3)", "ck_modules_key")
accept("module key in camelCase", "INSERT INTO modules(id,module_key,display_name,display_order) VALUES (3,'activityLog','Activity Log',3)")
accept("submodules valid", "INSERT INTO submodules(id,module_id,submodule_key,display_name,display_order) VALUES (1,1,'onboarding','Onboarding',1),(2,2,'companyProfile','Company Profile',1)")
refuse("submodule key duplicate", "INSERT INTO submodules(id,module_id,submodule_key,display_name,display_order) VALUES (3,1,'companyProfile','X',2)", "uq_submodules_key")
refuse("submodule key starting with a capital", "INSERT INTO submodules(id,module_id,submodule_key,display_name,display_order) VALUES (3,1,'LeavePolicy','X',2)", "ck_submodules_key")
GR = lambda module, sub="NULL", level="View": f"INSERT INTO employee_access_grants(employee_id,module_id,submodule_id,access_level,granted_by_employee_id) VALUES ({E4},{module},{sub},'{level}',{E1})"
LIVE = f"employee_id={E4} AND module_id=1 AND submodule_id IS NULL AND revoked_at IS NULL"
accept("grant on a whole module", GR(1))
refuse("grant: a second live grant for the same module", GR(1, level="Edit"), "uq_employee_access_grants_one_active")
accept("grant on one submodule of the same module", GR(1, 1))
refuse("grant: a submodule of another module", GR(1, 2), "fk_employee_access_grants_submodule_in_module")
refuse("grant: bad access level", GR(2, level="Owner"), "ck_employee_access_grants_level")
refuse("grant: unknown module", GR(9), "fk_employee_access_grants_module_id")
refuse("revoke without who revoked", f"UPDATE employee_access_grants SET revoked_at=now() WHERE {LIVE}", "ck_employee_access_grants_revoked")
refuse("revoke before the grant", f"UPDATE employee_access_grants SET revoked_at=granted_at - interval '1 day',revoked_by_employee_id={E1} WHERE {LIVE}", "ck_employee_access_grants_revoked")
accept("revoke with who and when", f"UPDATE employee_access_grants SET revoked_at=now(),revoked_by_employee_id={E1} WHERE {LIVE}")
accept("grant again after the revoke (level change)", GR(1, level="Edit"))
# ---------------------------------------------------------------- default values
default("default: employee status Draft, timesheet required", f"SELECT status||','||timesheet_required FROM employees WHERE id={E1}", "Draft,true")
default("default: address country_code US", f"SELECT country_code FROM addresses WHERE employee_id={E4}", "US")
default("default: onboarding document upload time set", "SELECT bool_and(uploaded_at IS NOT NULL)::text FROM employee_onboarding_packet_documents", "true")
default("default: grant time set, module and submodule active", "SELECT bool_and(g.granted_at IS NOT NULL AND m.is_active)::text FROM employee_access_grants g JOIN modules m ON m.id = g.module_id", "true")
default("default: national ID type active", "SELECT is_active::text FROM national_id_document_types WHERE document_type_code='SSN'", "true")
default("default: companies weekday and hours format", "SELECT timesheet_reminder_weekday||','||timesheet_hours_format FROM companies WHERE name='Cog'", "1,clock")
default("default: location country_code US and active", "SELECT country_code||','||is_active FROM locations WHERE name='Dallas'", "US,true")
default("default: department is_active", "SELECT is_active::text FROM departments WHERE name='Finance'", "true")
default("default: leave type is_unlimited false", "SELECT is_unlimited::text FROM leave_types WHERE name='Annual'", "false")
default("default: leave policy is_active", "SELECT is_active::text FROM leave_policies WHERE start_year=2026", "true")
default("default: policy line rollover_allowed false", f"SELECT rollover_allowed::text FROM leave_policy_lines WHERE leave_policy_id={POL} AND leave_type_id={L('Unpaid')}", "false")
default("default: category flags false", "SELECT is_serial_required||','||has_low_stock_tracking FROM asset_categories WHERE name='Mouse'", "false,false")
default("default: asset status In Stock", "SELECT status FROM assets WHERE asset_code='COG-00003'", "In Stock")
default("default: email_deliveries pending, 0 attempts, queued time set", "SELECT status||','||attempts||','||(created_at IS NOT NULL)||','||(sent_at IS NULL) FROM email_deliveries WHERE event_key='e'", "pending,0,true,true")
default("default: activity_log id and occurred_at set, actor empty", "SELECT (id IS NOT NULL)||','||(occurred_at IS NOT NULL)||','||(actor_employee_id IS NULL) FROM activity_log LIMIT 1", "true,true,true")
default("default: ids are generated uuids", "SELECT count(*) FILTER (WHERE id IS NULL) FROM assets", "0")
# ---------------------------------------------------------------- delete behaviour on referenced rows (no ON DELETE clause anywhere: deleting a referenced row is refused, nothing cascades)
refuse("delete a location the company points at", "DELETE FROM locations WHERE name='Dallas'", "fk_companies_location_id")
default("  ... and the company still exists", "SELECT count(*) FROM companies", "1")
refuse("delete a department that has a sub-department", "DELETE FROM departments WHERE name='Finance'", "fk_departments_parent_department_id")
default("  ... and the sub-department still exists", "SELECT count(*) FROM departments WHERE name='Payroll Support'", "1")
refuse("delete an employee who heads a department", "DELETE FROM employees WHERE id=" + E3, "fk_departments_head_employee_id")
refuse("delete a leave policy that has lines", "DELETE FROM leave_policies WHERE start_year=2026", "fk_leave_policy_lines_leave_policy_id")
default("  ... and its lines still exist", f"SELECT count(*) FROM leave_policy_lines WHERE leave_policy_id={POL}", "2")
refuse("delete a leave type that a line uses", "DELETE FROM leave_types WHERE name='Annual'", "fk_leave_policy_lines_leave_type_id")
refuse("delete a category that assets use", "DELETE FROM asset_categories WHERE name='Mouse'", "fk_assets_asset_category_id")
refuse("delete an OS that an asset uses", "DELETE FROM asset_category_os_platforms WHERE os_platform='Mac'", "fk_assets_category_os")
accept("setup: an asset with only an assignment", A("COG-00020", MOU))
accept("setup: its assignment", ins("(SELECT id FROM assets WHERE asset_code='COG-00020')", E1, "2026-03-01"))
refuse("delete an asset that has an assignment", "DELETE FROM assets WHERE asset_code='COG-00020'", "msg:assets are never deleted")
default("  ... and the assignment still exists", "SELECT count(*) FROM asset_assignments WHERE asset_id=(SELECT id FROM assets WHERE asset_code='COG-00020')", "1")
accept("delete a holiday (nothing points at it)", "DELETE FROM company_holidays WHERE name='Foundation Day'")
accept("delete a designation nothing uses", "DELETE FROM designations WHERE name='Engineer'")
accept("delete an email delivery row (clean-up job)", "DELETE FROM email_deliveries WHERE event_key='e'")
refuse("an asset nobody points at cannot be deleted either", "DELETE FROM assets WHERE asset_code='COG-00011'", "msg:assets are never deleted")
refuse("an asset code cannot be changed", "UPDATE assets SET asset_code='COG-99999' WHERE asset_code='COG-00011'", "msg:asset_code cannot be changed")
accept("other asset columns can still be changed", "UPDATE assets SET status='Under Repair', model='X1' WHERE asset_code='COG-00011'")
refuse("delete a skill an employee has", "DELETE FROM skills WHERE name='Python'", "fk_employee_skills_skill_id")
accept("delete a skill nobody has", "DELETE FROM skills WHERE name='SQL'")
refuse("delete a module that has submodules or grants", "DELETE FROM modules WHERE id=1",
       ("fk_submodules_module_id", "fk_employee_access_grants_module_id"))
refuse("delete a national ID type an employee uses", "DELETE FROM national_id_document_types WHERE document_type_code='SSN'",
       "fk_employees_national_id_document_type_id")
refuse("delete a Draft employee who manages someone", f"DELETE FROM employees WHERE id={E5}", "fk_employees_reporting_manager_id")
# ---------------------------------------------------------------- clients
CL = lambda name, cat, extra="", vals="": f"INSERT INTO clients(client_name,account_owner,client_category{extra}) VALUES ('{name}',{E1},'{cat}'{vals})"
accept("client valid (Internal)", CL("Cognine Internal", "INTERNAL"))
accept("client valid (Direct)", CL("Acme", "DIRECT"))
accept("client valid (Intermediary)", CL("Broker Co", "INTERMEDIARY"))
default("client codes come from client_code_seq", "SELECT string_agg(client_code, ',' ORDER BY client_code) FROM clients", "CLI1001,CLI1002,CLI1003")
refuse("client code cannot be changed", "UPDATE clients SET client_code='CLI9999' WHERE client_name='Acme'", "msg:client_code cannot be changed")
refuse("client code supplied by the caller refused", CL("Dup Code", "DIRECT", ",client_code", ",'CLI1002'"), "msg:client_code is generated by the database")
refuse("client code supplied as a new value refused too", CL("Own Code", "DIRECT", ",client_code", ",'CLI5'"), "msg:client_code is generated by the database")
accept("client code sent as NULL is still generated", CL("Null Code", "DIRECT", ",client_code", ",NULL"))
default("  ... and it got a CLI code", "SELECT client_code LIKE 'CLI%' FROM clients WHERE client_name='Null Code'", "True")
setup("SELECT setval('client_code_seq', 1002, false)")
refuse("client code stays unique even if the sequence is rewound", CL("Rewound", "DIRECT"), "uq_clients_client_code")
setup("SELECT setval('client_code_seq', (SELECT max(substr(client_code, 4)::int) FROM clients))")
refuse("active client name duplicate ignoring case", CL("ACME", "DIRECT"), "uq_clients_active_name")
accept("inactive client with the same name allowed", CL("acme", "DIRECT", ",status", ",'INACTIVE'"))
refuse("reactivating it while the other one is active refused", "UPDATE clients SET status='ACTIVE' WHERE client_name='acme'", "uq_clients_active_name")
refuse("client name empty refused", CL("", "DIRECT"), "ck_clients_name_trimmed")
refuse("client name of only spaces refused", CL("   ", "DIRECT"), "ck_clients_name_trimmed")
refuse("client name of only a tab and a line break refused", CL("' || E'\\t\\n' || '", "DIRECT"), "ck_clients_name_trimmed")
refuse("client renamed to blank refused", "UPDATE clients SET client_name=' ' WHERE client_name='Acme'", "ck_clients_name_trimmed")
refuse("client name with a trailing space refused (would sit beside the active 'Acme')", CL("Acme ", "DIRECT"), "ck_clients_name_trimmed")
refuse("client name with a leading space refused", CL(" Acme", "DIRECT"), "ck_clients_name_trimmed")
refuse("client name ending in a line break refused", CL("Acme' || E'\\n' || '", "DIRECT"), "ck_clients_name_trimmed")
refuse("client renamed with a trailing space refused", "UPDATE clients SET client_name='Acme ' WHERE client_name='Acme'", "ck_clients_name_trimmed")
accept("client name of one character allowed", CL("Z", "DIRECT"))
accept("client name with a space inside allowed", CL("Acme Corp", "DIRECT"))
refuse("client bad category", CL("X", "PARTNER"), "ck_clients_category")
refuse("client bad status", CL("X", "DIRECT", ",status", ",'ARCHIVED'"), "ck_clients_status")
refuse("client needs an account owner", "INSERT INTO clients(client_name,client_category) VALUES ('X','DIRECT')", "notnull:account_owner")
refuse("client account owner must be an employee", "INSERT INTO clients(client_name,account_owner,client_category) VALUES ('X',gen_random_uuid(),'DIRECT')", "fk_clients_account_owner")
# ---------------------------------------------------------------- client locations
INT = "(SELECT id FROM clients WHERE client_name='Cognine Internal')"
DIR = "(SELECT id FROM clients WHERE client_name='Acme')"
MID = "(SELECT id FROM clients WHERE client_name='Broker Co')"
DAL = "(SELECT id FROM locations WHERE name='Dallas')"
accept("internal client location: an office pick", f"INSERT INTO client_locations(client_id,office_location_id,location_name) VALUES ({INT},{DAL},'HQ')")
refuse("internal client location: a typed address refused", f"INSERT INTO client_locations(client_id,address_line_1,country) VALUES ({INT},'1 Road','US')", "msg:must be one of the company's office locations")
accept("direct client location: a typed address", f"INSERT INTO client_locations(client_id,location_name,address_line_1,city,country) VALUES ({DIR},'Acme NYC','5 Ave','New York','US')")
refuse("direct client location: an office pick refused", f"INSERT INTO client_locations(client_id,office_location_id) VALUES ({DIR},{DAL})", "msg:must be a typed address")
accept("intermediary client location: a typed address", f"INSERT INTO client_locations(client_id,location_name,address_line_1,country) VALUES ({MID},'Broker London','1 Strand','GB')")
refuse("location: office pick and typed address together refused", f"INSERT INTO client_locations(client_id,office_location_id,address_line_1,country) VALUES ({INT},{DAL},'1 Road','US')", "ck_client_locations_office_or_typed")
refuse("location: neither an office pick nor an address refused", f"INSERT INTO client_locations(client_id,location_name) VALUES ({DIR},'Nowhere')", "ck_client_locations_office_or_typed")
refuse("location: a typed address needs a country", f"INSERT INTO client_locations(client_id,address_line_1) VALUES ({DIR},'1 Road')", "ck_client_locations_office_or_typed")
refuse("location: cannot move to another client", f"UPDATE client_locations SET client_id={MID} WHERE location_name='Acme NYC'", "msg:cannot be moved to another client")
refuse("client category change that breaks its locations refused", "UPDATE clients SET client_category='INTERNAL' WHERE client_name='Acme'", "msg:does not match the client's existing locations")
accept("client category change Direct to Intermediary allowed", "UPDATE clients SET client_category='INTERMEDIARY' WHERE client_name='Acme'")
accept("  ... and back to Direct", "UPDATE clients SET client_category='DIRECT' WHERE client_name='Acme'")
# ---------------------------------------------------------------- projects
PR = lambda name, client, extra="", vals="": f"INSERT INTO projects(name,client_id,start_date{extra}) VALUES ('{name}',{client},'2026-01-01'{vals})"
accept("project valid, with a typed code in small letters", PR("Acme Portal", DIR, ",region,billing_type,project_type,project_code", ",'NA','FIXED_BID','DEVELOPMENT','acme1'"))
default("project number comes from project_number_seq, code stored in capitals", "SELECT project_number||','||project_code FROM projects WHERE name='Acme Portal'", "PRJ1001,ACME1")
refuse("project number cannot be changed", "UPDATE projects SET project_number='PRJ9999' WHERE name='Acme Portal'", "msg:project_number cannot be changed")
refuse("project number supplied by the caller refused", PR("Own Number", DIR, ",project_number", ",'PRJ5'"), "msg:project_number is generated by the database")
setup("SELECT setval('project_number_seq', 1001, false)")
refuse("project number stays unique even if the sequence is rewound", PR("Rewound", DIR), "uq_projects_project_number")
setup("SELECT setval('project_number_seq', (SELECT max(substr(project_number, 4)::int) FROM projects))")
refuse("project code duplicate refused", PR("Dup Code", DIR, ",project_code", ",'ACME1'"), "uq_projects_project_code")
refuse("project code duplicate in other capitals refused", PR("Dup Code", DIR, ",project_code", ",'Acme1'"), "uq_projects_project_code")
refuse("project code with a hyphen refused", PR("X", DIR, ",project_code", ",'AC-1'"), "ck_projects_project_code")
refuse("project code with a space refused", PR("X", DIR, ",project_code", ",'AC 1'"), "ck_projects_project_code")
refuse("project code with an underscore refused", PR("X", DIR, ",project_code", ",'AC_1'"), "ck_projects_project_code")
refuse("project code empty text refused", PR("X", DIR, ",project_code", ",''"), "ck_projects_project_code")
refuse("project code longer than 8 refused", PR("X", DIR, ",project_code", ",'ABCDEFGH9'"), "msg:value too long")
accept("project code of exactly 8 letters and digits allowed", PR("Acme Eight", DIR, ",project_code", ",'AB12CD34'"))
accept("project without a code allowed", PR("Acme No Code 1", MID))
accept("a second project without a code allowed", PR("Acme No Code 2", MID))
accept("project code can be changed", "UPDATE projects SET project_code='new1' WHERE name='Acme Portal'")
default("  ... and the new code is stored in capitals", "SELECT project_code FROM projects WHERE name='Acme Portal'", "NEW1")
refuse("project code changed to one another project uses refused", "UPDATE projects SET project_code='ab12cd34' WHERE name='Acme Portal'", "uq_projects_project_code")
refuse("project code changed to one with a special character refused", "UPDATE projects SET project_code='NEW-1' WHERE name='Acme Portal'", "ck_projects_project_code")
accept("project code can be removed", "UPDATE projects SET project_code=NULL WHERE name='Acme Portal'")
accept("project code can be added later to a project without one", "UPDATE projects SET project_code='ACME1' WHERE name='Acme Portal'")
accept("a removed code can be reused by another project", "UPDATE projects SET project_code='NEW1' WHERE name='Acme No Code 1'")
refuse("project name empty refused", PR("", DIR), "ck_projects_name_trimmed")
refuse("project name of only spaces refused", PR("   ", DIR), "ck_projects_name_trimmed")
refuse("project renamed to blank refused", "UPDATE projects SET name=' ' WHERE name='Acme Portal'", "ck_projects_name_trimmed")
refuse("project name with a leading space refused", PR(" Acme Web", DIR), "ck_projects_name_trimmed")
refuse("project renamed with a trailing space refused", "UPDATE projects SET name='Acme Portal ' WHERE name='Acme Portal'", "ck_projects_name_trimmed")
refuse("project needs a client", "INSERT INTO projects(name,start_date) VALUES ('X','2026-01-01')", "notnull:client_id")
refuse("project client must exist", PR("X", "gen_random_uuid()"), "fk_projects_client_id")
refuse("project bad region", PR("X", DIR, ",region", ",'EU'"), "ck_projects_region")
accept("project billing type is not limited by the database", PR("Acme Hourly", DIR, ",billing_type", ",'HOURLY'"))
refuse("project bad status", PR("X", DIR, ",status", ",'DONE'"), "ck_projects_status")
refuse("project planned end before start", PR("X", DIR, ",planned_end_date", ",'2025-12-31'"), "ck_projects_planned_end")
refuse("project actual end before start", PR("X", DIR, ",actual_end_date", ",'2025-12-31'"), "ck_projects_actual_end")
accept("project end dates on the start date allowed", PR("Acme Same Day", DIR, ",planned_end_date,actual_end_date", ",'2026-01-01','2026-01-01'"))
refuse("end customer name on a Direct client's project refused", PR("X", DIR, ",end_customer_name", ",'Globex'"), "msg:end customer name")
accept("end customer name on an Intermediary client's project", PR("Broker Deal", MID, ",end_customer_name", ",'Globex'"))
refuse("client category change away from Intermediary while a project has an end customer refused", "UPDATE clients SET client_category='DIRECT' WHERE client_name='Broker Co'", "msg:end customer name")
refuse("moving that project to a Direct client refused", f"UPDATE projects SET client_id={DIR} WHERE name='Broker Deal'", "msg:end customer name")
# ---------------------------------------------------------------- project members and stakeholders
PJ = "(SELECT id FROM projects WHERE name='Acme Portal')"
M = lambda e, role: f"INSERT INTO project_members(project_id,employee_id,role) VALUES ({PJ},{e},'{role}')"
accept("member: an account owner", M(E1, "ACCOUNT_OWNER"))
accept("member: the same employee as project manager", M(E1, "PROJECT_MANAGER"))
accept("member: a second account owner", M(E2, "ACCOUNT_OWNER"))
refuse("member: the same employee and role twice", M(E1, "ACCOUNT_OWNER"), "uq_project_members_project_employee_role")
refuse("member: bad role", M(E3, "SPONSOR"), "ck_project_members_role")
refuse("member: unknown employee", M("gen_random_uuid()", "PROJECT_MANAGER"), "fk_project_members_employee_id")
accept("stakeholder: free text", f"INSERT INTO project_stakeholders(project_id,name,title,department,email,phone_number) VALUES ({PJ},'Jane Roe','CTO','IT','jane@acme.com','+1 555 0100')")
refuse("stakeholder needs a name", f"INSERT INTO project_stakeholders(project_id) VALUES ({PJ})", "notnull:name")
refuse("stakeholder name empty refused", f"INSERT INTO project_stakeholders(project_id,name) VALUES ({PJ},'')", "ck_project_stakeholders_name_trimmed")
refuse("stakeholder name of only spaces refused", f"INSERT INTO project_stakeholders(project_id,name) VALUES ({PJ},'   ')", "ck_project_stakeholders_name_trimmed")
refuse("stakeholder name with a trailing space refused", f"INSERT INTO project_stakeholders(project_id,name) VALUES ({PJ},'Jane Roe ')", "ck_project_stakeholders_name_trimmed")
# ---------------------------------------------------------------- addresses and allocations
ADR1 = "'00000000-0000-0000-0000-0000000000d1'"
ADR2 = "'00000000-0000-0000-0000-0000000000d2'"
accept("address of employee 1", f"INSERT INTO addresses(id,employee_id,address_line_1) VALUES ({ADR1},{E1},'1 Main St')")
accept("address of employee 2", f"INSERT INTO addresses(id,employee_id,address_line_1) VALUES ({ADR2},{E2},'2 Main St')")
refuse("address of an unknown employee refused", "INSERT INTO addresses(employee_id,address_line_1) VALUES (gen_random_uuid(),'1 Main St')", "fk_addresses_employee_id")
AL = lambda extra="", vals="", pct="50": f"INSERT INTO allocations(project_id,employee_id,allocation_percentage,start_date{extra}) VALUES ({PJ},{E1},{pct},'2026-01-01'{vals})"
NYC = "(SELECT id FROM client_locations WHERE location_name='Acme NYC')"
LON = "(SELECT id FROM client_locations WHERE location_name='Broker London')"
accept("allocation valid, not billable", AL())
accept("allocation 0.01 percent allowed", AL(pct="0.01"))
accept("allocation 100 percent allowed", AL(pct="100"))
refuse("allocation 0 percent refused", AL(pct="0"), "ck_allocations_percentage")
refuse("allocation over 100 percent refused", AL(pct="100.01"), "ck_allocations_percentage")
accept("billable allocation with a billable percentage", AL(",is_billable,billable_percentage", ",true,40"))
accept("billable percentage equal to the allocation allowed", AL(",is_billable,billable_percentage", ",true,50"))
refuse("billable without a billable percentage refused", AL(",is_billable", ",true"), "ck_allocations_billable")
refuse("not billable with a billable percentage refused", AL(",billable_percentage", ",10"), "ck_allocations_billable")
refuse("billable percentage above the allocation refused", AL(",is_billable,billable_percentage", ",true,60"), "ck_allocations_billable_max")
refuse("billable percentage of 0 refused", AL(",is_billable,billable_percentage", ",true,0"), "ck_allocations_billable_max")
refuse("allocation end before start refused", AL(",end_date", ",'2025-12-31'"), "ck_allocations_dates")
refuse("allocation with two work places refused", AL(",work_office_location_id,work_address_id", f",{DAL},{ADR1}"), "ck_allocations_one_work_place")
accept("allocation at a company office", AL(",work_office_location_id", f",{DAL}"))
accept("allocation at a location of the project's client", AL(",client_location_id", f",{NYC}"))
refuse("allocation at another client's location refused", AL(",client_location_id", f",{LON}"), "msg:must belong to the project's client")
accept("allocation at the employee's own address", AL(",work_address_id", f",{ADR1}"))
refuse("allocation at another employee's address refused", AL(",work_address_id", f",{ADR2}"), "msg:allocated employee's own address")
refuse("allocation at an unknown address refused", AL(",work_address_id", ",gen_random_uuid()"), "fk_allocations_work_address_id")
refuse("moving a remote allocation to another employee refused", f"UPDATE allocations SET employee_id={E2} WHERE work_address_id={ADR1}", "msg:allocated employee's own address")
refuse("moving an address in use to another employee refused", f"UPDATE addresses SET employee_id={E2} WHERE id={ADR1}", "msg:used by an allocation")
accept("moving an unused address to another employee allowed", f"UPDATE addresses SET employee_id={E3} WHERE id={ADR2}")
refuse("moving a project to another client while an allocation uses its client's location refused", f"UPDATE projects SET client_id={MID} WHERE name='Acme Portal'", "msg:use a location of its current client")
# ---------------------------------------------------------------- clients and projects: defaults
default("default: client status ACTIVE", "SELECT status FROM clients WHERE client_name='Acme'", "ACTIVE")
default("default: project status ACTIVE", "SELECT status FROM projects WHERE name='Acme Portal'", "ACTIVE")
default("default: allocation not billable", "SELECT is_billable::text FROM allocations WHERE billable_percentage IS NULL LIMIT 1", "false")
# ---------------------------------------------------------------- clients and projects: no cascade
refuse("delete a client that has locations and projects", "DELETE FROM clients WHERE client_name='Acme'", ("fk_client_locations_client_id", "fk_projects_client_id"))
default("  ... and its locations and projects still exist", f"SELECT (SELECT count(*) FROM client_locations WHERE client_id={DIR})||','||(SELECT count(*) FROM projects WHERE client_id={DIR})", "1,4")
refuse("delete a project that has members, stakeholders and allocations", "DELETE FROM projects WHERE name='Acme Portal'", ("fk_project_members_project_id", "fk_project_stakeholders_project_id", "fk_allocations_project_id"))
default("  ... and its members, stakeholders and allocations still exist", f"SELECT (SELECT count(*) FROM project_members WHERE project_id={PJ})||','||(SELECT count(*) FROM project_stakeholders WHERE project_id={PJ})||','||(SELECT count(*) > 0 FROM allocations WHERE project_id={PJ})", "3,1,true")
refuse("delete a client location an allocation uses", "DELETE FROM client_locations WHERE location_name='Acme NYC'", "fk_allocations_client_location_id")
refuse("delete an address an allocation uses", f"DELETE FROM addresses WHERE id={ADR1}", "fk_allocations_work_address_id")
accept("delete a project that has no children", "DELETE FROM projects WHERE name='Acme Same Day'")
accept("archive a client by setting it inactive", "UPDATE clients SET status='INACTIVE' WHERE client_name='Broker Co'")

# ---------------------------------------------------------------- portal: timesheets / leave / employee_requests
setup(f"""INSERT INTO projects(id,name,client_id,start_date) VALUES ('22222222-2222-2222-2222-222222222222','Timesheet Project',{DIR},'2026-01-01');""")
PRJ = "'22222222-2222-2222-2222-222222222222'"
accept(
    "timesheet draft valid",
    f"INSERT INTO timesheets(employee_id, week_start_date, status) VALUES ({E1}, '2026-10-06', 'Draft')",
)
refuse(
    "timesheet bad status",
    f"INSERT INTO timesheets(employee_id, week_start_date, status) VALUES ({E1}, '2026-10-13', 'Nope')",
    "ck_timesheets_status",
)
refuse(
    "timesheet duplicate employee+week",
    f"INSERT INTO timesheets(employee_id, week_start_date) VALUES ({E1}, '2026-10-06')",
    "uq_timesheets_employee_week",
)
refuse(
    "timesheet unknown employee",
    "INSERT INTO timesheets(employee_id, week_start_date) VALUES (gen_random_uuid(), '2026-10-20')",
    "fk_timesheets_employee_id",
)
accept(
    "timesheet item allocated project row",
    f"INSERT INTO timesheet_items(timesheet_id, category, project_id, activity_type, sort_order) "
    f"VALUES ((SELECT id FROM timesheets WHERE employee_id={E1} AND week_start_date='2026-10-06'), "
    f"'Allocated Projects', {PRJ}, 'Development', 0)",
)
refuse(
    "timesheet item bad category",
    f"INSERT INTO timesheet_items(timesheet_id, category, sort_order) "
    f"VALUES ((SELECT id FROM timesheets WHERE employee_id={E1} AND week_start_date='2026-10-06'), "
    f"'Project', 1)",
    "ck_timesheet_items_category",
)
TI = "(SELECT id FROM timesheet_items WHERE timesheet_id=(SELECT id FROM timesheets WHERE employee_id=" + E1 + " AND week_start_date='2026-10-06') LIMIT 1)"
accept(
    "timesheet day hours valid",
    f"INSERT INTO timesheet_day_entries(timesheet_item_id, work_date, hours) VALUES ({TI}, '2026-10-06', 8)",
)
refuse(
    "timesheet day negative hours",
    f"INSERT INTO timesheet_day_entries(timesheet_item_id, work_date, hours) VALUES ({TI}, '2026-10-07', -1)",
    "ck_timesheet_day_entries_hours_nonneg",
)
refuse(
    "timesheet day hours over 24",
    f"INSERT INTO timesheet_day_entries(timesheet_item_id, work_date, hours) VALUES ({TI}, '2026-10-08', 24.01)",
    "ck_timesheet_day_entries_hours_max",
)
refuse(
    "timesheet day duplicate item+date",
    f"INSERT INTO timesheet_day_entries(timesheet_item_id, work_date, hours) VALUES ({TI}, '2026-10-06', 3)",
    "uq_timesheet_day_entries_item_date",
)
accept(
    "leave request valid",
    f"INSERT INTO leave_requests(employee_id, leave_type_id, from_date, to_date, status, submitted_at) "
    f"VALUES ({E1}, {L('Annual')}, '2026-10-08', '2026-10-09', 'Pending', now())",
)
refuse(
    "leave request end before start",
    f"INSERT INTO leave_requests(employee_id, leave_type_id, from_date, to_date, status, submitted_at) "
    f"VALUES ({E1}, {L('Annual')}, '2026-10-10', '2026-10-08', 'Pending', now())",
    "ck_leave_requests_date_range",
)
refuse(
    "leave request bad status",
    f"INSERT INTO leave_requests(employee_id, leave_type_id, from_date, to_date, status, submitted_at) "
    f"VALUES ({E1}, {L('Annual')}, '2026-10-11', '2026-10-11', 'Nope', now())",
    "ck_leave_requests_status",
)
LR = f"(SELECT id FROM leave_requests WHERE employee_id={E1} AND from_date='2026-10-08' LIMIT 1)"
accept(
    "leave day full valid",
    f"INSERT INTO leave_request_days(leave_request_id, leave_date, half_part) VALUES ({LR}, '2026-10-08', 'full')",
)
refuse(
    "leave day full + first same date refused",
    f"INSERT INTO leave_request_days(leave_request_id, leave_date, half_part) VALUES ({LR}, '2026-10-08', 'first')",
    "msg:cannot mix full with first/second",
)
refuse(
    "leave day bad half_part",
    f"INSERT INTO leave_request_days(leave_request_id, leave_date, half_part) VALUES ({LR}, '2026-10-09', 'third')",
    "ck_leave_request_days_half_part",
)
accept(
    "leave day first half valid",
    f"INSERT INTO leave_request_days(leave_request_id, leave_date, half_part) VALUES ({LR}, '2026-10-09', 'first')",
)
accept(
    "leave day second half with first same date allowed",
    f"INSERT INTO leave_request_days(leave_request_id, leave_date, half_part) VALUES ({LR}, '2026-10-09', 'second')",
)
refuse(
    "leave day full after halves same date refused",
    f"INSERT INTO leave_request_days(leave_request_id, leave_date, half_part) VALUES ({LR}, '2026-10-09', 'full')",
    "msg:cannot mix full with first/second",
)
accept(
    "leave balance valid",
    f"INSERT INTO employee_leave_balances(employee_id, leave_type_id, leave_year, entitled_days, carried_forward_days) "
    f"VALUES ({E1}, {L('Annual')}, 2026, 20, 2)",
)
refuse(
    "leave balance duplicate year",
    f"INSERT INTO employee_leave_balances(employee_id, leave_type_id, leave_year, entitled_days) "
    f"VALUES ({E1}, {L('Annual')}, 2026, 10)",
    "uq_employee_leave_balances_employee_type_year",
)
accept(
    "employee_request profile valid",
    f"INSERT INTO employee_requests(request_kind, requested_for_employee_id, submitted_by_employee_id, "
    f"status, requested_at, field_name, old_value, new_value) "
    f"VALUES ('profile_update', {E1}, {E1}, 'Open', now(), 'phone', '1', '2')",
)
refuse(
    "employee_request bad kind",
    f"INSERT INTO employee_requests(request_kind, requested_for_employee_id, submitted_by_employee_id, "
    f"status, requested_at) VALUES ('it_request', {E1}, {E1}, 'Open', now())",
    "ck_employee_requests_kind",
)
refuse(
    "employee_request profile without field_name",
    f"INSERT INTO employee_requests(request_kind, requested_for_employee_id, submitted_by_employee_id, "
    f"status, requested_at) VALUES ('profile_update', {E1}, {E1}, 'Open', now())",
    "ck_employee_requests_profile_fields",
)
refuse(
    "employee_request asset without type",
    f"INSERT INTO employee_requests(request_kind, requested_for_employee_id, submitted_by_employee_id, "
    f"status, requested_at) VALUES ('asset', {E1}, {E1}, 'Open', now())",
    "ck_employee_requests_asset_fields",
)
refuse(
    "employee_request correction Completed refused",
    f"INSERT INTO employee_requests(request_kind, requested_for_employee_id, submitted_by_employee_id, "
    f"status, requested_at, field_name, new_value) "
    f"VALUES ('correction', {E1}, {E1}, 'Completed', now(), 'legal_name', 'X')",
    "ck_employee_requests_completed_kinds",
)
refuse(
    "employee_request bad status",
    f"INSERT INTO employee_requests(request_kind, requested_for_employee_id, submitted_by_employee_id, "
    f"status, requested_at, field_name) "
    f"VALUES ('profile_update', {E1}, {E1}, 'Nope', now(), 'phone')",
    "ck_employee_requests_status",
)
accept(
    "employee_request asset valid",
    f"INSERT INTO employee_requests(request_kind, requested_for_employee_id, submitted_by_employee_id, "
    f"status, requested_at, asset_request_type, asset_category_id) "
    f"VALUES ('asset', {E1}, {E1}, 'Open', now(), 'new', {LAP})",
)
refuse(
    "employee_request bad asset_request_type",
    f"INSERT INTO employee_requests(request_kind, requested_for_employee_id, submitted_by_employee_id, "
    f"status, requested_at, asset_request_type, asset_category_id) "
    f"VALUES ('asset', {E1}, {E1}, 'Open', now(), 'New', {LAP})",
    "ck_employee_requests_asset_request_type",
)
refuse(
    "delete employee who has portal rows",
    f"DELETE FROM employees WHERE id={E1}",
    (
        "fk_timesheets_employee_id",
        "fk_leave_requests_employee_id",
        "fk_employee_leave_balances_employee_id",
        "fk_employee_requests_requested_for_employee_id",
        "fk_employee_requests_submitted_by_employee_id",
        "fk_asset_assignments_assigned_to_employee_id",
        "fk_onboarding_documents_uploaded_by_employee_id",
        "fk_employee_access_grants_granted_by_employee_id",
        "fk_employee_access_grants_revoked_by_employee_id",
        "fk_addresses_employee_id",
        "fk_clients_account_owner",
        "fk_project_members_employee_id",
        "fk_allocations_employee_id",
    ),
)

run(conn.close())
run(drop_database(DB))
for r in results:
    print(*r, sep=" | ")
failed = sum(r[0] == "FAIL" for r in results)
print(sum(r[0] == "PASS" for r in results), "passed,", failed, "failed,", len(results), "checks")
raise SystemExit(1 if failed else 0)
