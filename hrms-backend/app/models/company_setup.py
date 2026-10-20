"""Company Setup: locations, companies, departments, designations, leave types and policies, holidays,
email deliveries. Rules the database cannot hold (loops, deactivation blocks, country address rules) are
enforced in the service layer."""
import datetime as dt
import uuid
from decimal import Decimal

from sqlalchemy import (
    DDL, Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Numeric,
    SmallInteger, String, Text, UniqueConstraint, event, func, text,
)
from sqlalchemy.dialects.postgresql import CHAR
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, uuid_pk


class Location(Base):
    __tablename__ = "locations"
    __table_args__ = (
        # Names are unique ignoring capital letters.
        Index("uq_locations_name", func.lower(text("name")), unique=True),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(150))
    address_line_1: Mapped[str] = mapped_column(String(200))
    address_line_2: Mapped[str | None] = mapped_column(String(200))
    city: Mapped[str | None] = mapped_column(String(100))
    state: Mapped[str | None] = mapped_column(String(100))
    postal_code: Mapped[str | None] = mapped_column(String(20))
    country_code: Mapped[str] = mapped_column(CHAR(2), server_default=text("'US'"))
    timezone: Mapped[str] = mapped_column(String(64))
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))


class Company(Base):
    """The company profile. One row today: the unique index on a constant allows at most one row. Drop that index
    if the product ever supports several companies."""
    __tablename__ = "companies"
    __table_args__ = (
        Index("uq_companies_single_row", text("(true)"), unique=True),
        CheckConstraint(
            "company_type IN ('Private Limited', 'Public Limited', 'LLC', 'LLP', 'C Corporation', "
            "'S Corporation', 'Partnership', 'Sole Proprietorship', 'Non Profit')",
            name="ck_companies_company_type"),
        CheckConstraint("timesheet_reminder_weekday BETWEEN 0 AND 6", name="ck_companies_reminder_weekday"),
        CheckConstraint("timesheet_hours_format IN ('clock', 'decimal')", name="ck_companies_hours_format"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(200))
    company_type: Mapped[str] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(254))
    phone: Mapped[str | None] = mapped_column(String(30))
    website: Mapped[str | None] = mapped_column(String(300))
    logo_object_key: Mapped[str | None] = mapped_column(String(500))
    location_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("locations.id", name="fk_companies_location_id"))
    asset_code_prefix: Mapped[str] = mapped_column(String(10))
    timesheet_reminder_weekday: Mapped[int] = mapped_column(SmallInteger, server_default=text("1"))
    timesheet_hours_format: Mapped[str] = mapped_column(String(10), server_default=text("'clock'"))


# Stops a department hierarchy from forming a loop. Before a parent is set or changed, walk up from the chosen
# parent; if the walk reaches the department itself, refuse. An advisory lock makes parent changes run one at a
# time, so two moves that are each fine alone cannot make a loop together. A department that is its own parent
# is left to ck_departments_not_own_parent. One statement each: installed by create_all (after_create below)
# and again, harmlessly, by schema_ensure.
DEPARTMENT_LOOP_SQL = (
    """CREATE OR REPLACE FUNCTION departments_block_loop() RETURNS trigger AS $$
BEGIN
    IF NEW.parent_department_id IS NULL OR NEW.parent_department_id = NEW.id THEN
        RETURN NEW;
    END IF;
    PERFORM pg_advisory_xact_lock(8204118);
    IF EXISTS (
        WITH RECURSIVE up(id, parent) AS (
            SELECT id, parent_department_id FROM departments WHERE id = NEW.parent_department_id
            UNION
            SELECT d.id, d.parent_department_id FROM departments d JOIN up ON d.id = up.parent
        )
        SELECT 1 FROM up WHERE id = NEW.id
    ) THEN
        RAISE EXCEPTION USING MESSAGE = 'a department cannot be placed under itself or one of its sub-departments',
                              ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql""",
    "DROP TRIGGER IF EXISTS trg_departments_no_loop ON departments",
    """CREATE TRIGGER trg_departments_no_loop BEFORE INSERT OR UPDATE OF parent_department_id ON departments
    FOR EACH ROW EXECUTE FUNCTION departments_block_loop()""",
)


class Department(Base):
    __tablename__ = "departments"
    __table_args__ = (
        CheckConstraint("parent_department_id <> id", name="ck_departments_not_own_parent"),
        Index("uq_departments_name", func.lower(text("name")), unique=True),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(150))
    parent_department_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("departments.id", name="fk_departments_parent_department_id"))
    head_employee_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("employees.id", name="fk_departments_head_employee_id"))
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))


for _statement in DEPARTMENT_LOOP_SQL:
    event.listen(Department.__table__, "after_create", DDL(_statement))


class Designation(Base):
    __tablename__ = "designations"
    __table_args__ = (Index("uq_designations_name", func.lower(text("name")), unique=True),)

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(150))
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))


class LeaveType(Base):
    """A fixed list created by the system at startup."""
    __tablename__ = "leave_types"
    __table_args__ = (Index("uq_leave_types_name", func.lower(text("name")), unique=True),)

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(100))
    is_unlimited: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))


class LeavePolicy(Base):
    __tablename__ = "leave_policies"
    __table_args__ = (
        CheckConstraint("end_year >= start_year", name="ck_leave_policies_years"),
        Index("uq_leave_policies_name_period", func.lower(text("name")), "start_year", "end_year", unique=True),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(150))
    start_year: Mapped[int] = mapped_column(SmallInteger)
    end_year: Mapped[int] = mapped_column(SmallInteger)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))


class LeavePolicyLine(Base):
    __tablename__ = "leave_policy_lines"
    __table_args__ = (
        UniqueConstraint("leave_policy_id", "leave_type_id", name="uq_leave_policy_lines_policy_type"),
        CheckConstraint(
            "days_allowed IS NULL OR (days_allowed >= 0 AND days_allowed * 2 = trunc(days_allowed * 2))",
            name="ck_leave_policy_lines_days"),
        CheckConstraint(
            "(rollover_allowed AND days_allowed IS NOT NULL AND max_rollover_days IS NOT NULL "
            "AND max_rollover_days >= 0.5 AND max_rollover_days <= days_allowed "
            "AND max_rollover_days * 2 = trunc(max_rollover_days * 2)) "
            "OR (NOT rollover_allowed AND max_rollover_days IS NULL)",
            name="ck_leave_policy_lines_rollover"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    leave_policy_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("leave_policies.id", name="fk_leave_policy_lines_leave_policy_id"))
    leave_type_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("leave_types.id", name="fk_leave_policy_lines_leave_type_id"))
    days_allowed: Mapped[Decimal | None] = mapped_column(Numeric(5, 1))
    rollover_allowed: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    max_rollover_days: Mapped[Decimal | None] = mapped_column(Numeric(5, 1))


class CompanyHoliday(Base):
    """Really deleted (no is_active), but only today's and future ones (service rule)."""
    __tablename__ = "company_holidays"
    __table_args__ = (
        CheckConstraint(
            "holiday_type IN ('Federal Holiday', 'Observed Holiday', 'Company Holiday', "
            "'Religious / Cultural Holiday', 'State / Regional Holiday', 'Other')",
            name="ck_company_holidays_type"),
        # Starts with the date, so it also serves "holidays in a year".
        Index("uq_company_holidays_date_name", "holiday_date", func.lower(text("name")), unique=True),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    holiday_date: Mapped[dt.date] = mapped_column(Date)
    name: Mapped[str] = mapped_column(String(150))
    holiday_type: Mapped[str] = mapped_column(String(40))


class EmailDelivery(Base):
    """Email queue (outbox) and read-only delivery log, one row per recipient. Up to 6 attempts (the database
    refuses a count outside 0 to 6); sent rows are cleaned after 90 days and failed rows after 1 year by a
    scheduled job."""
    __tablename__ = "email_deliveries"
    __table_args__ = (
        CheckConstraint("status IN ('pending', 'sent', 'failed')", name="ck_email_deliveries_status"),
        CheckConstraint("attempts BETWEEN 0 AND 6", name="ck_email_deliveries_attempts"),
        # A sent email has a sent time, and only a sent email has one.
        CheckConstraint("(status = 'sent') = (sent_at IS NOT NULL)", name="ck_email_deliveries_sent_at"),
        # A pending email always has a time for its next attempt (the sender looks for the ones that are due).
        CheckConstraint("status <> 'pending' OR next_attempt_at IS NOT NULL", name="ck_email_deliveries_pending_due"),
        # What is due now. Sent rows drop out of this index.
        Index("ix_email_deliveries_due", "next_attempt_at", postgresql_where=text("status = 'pending'")),
        # Delivery log tabs (failed, sent) and status counts, newest first.
        Index("ix_email_deliveries_status_created", "status", "created_at"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    event_key: Mapped[str] = mapped_column(String(80))
    to_email: Mapped[str] = mapped_column(String(254))
    subject: Mapped[str] = mapped_column(String(300))
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(10), server_default=text("'pending'"))
    attempts: Mapped[int] = mapped_column(SmallInteger, server_default=text("0"))
    last_error: Mapped[str | None] = mapped_column(Text)
    next_attempt_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    sent_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
