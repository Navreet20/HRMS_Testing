"""Employee Portal — redesigned 7 tables.

Timesheets, leave applications, leave balances, and merged employee_requests
(profile_update | asset | correction). IT_REQUEST stays out. Leave stays
outside employee_requests.

External FKs point at shared module tables:
  employees, projects, leave_types, assets, asset_categories.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    DDL,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    event,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, uuid_pk


# ---------------------------------------------------------------------------
# Timesheets (3)
# ---------------------------------------------------------------------------


class Timesheet(Base):
    """One employee, one week. Replaces TIMESHEET_HEADER."""

    __tablename__ = "timesheets"
    __table_args__ = (
        UniqueConstraint(
            "employee_id",
            "week_start_date",
            name="uq_timesheets_employee_week",
        ),
        Index("ix_timesheets_status", "status"),
        Index("ix_timesheets_week_start_date", "week_start_date"),
        Index("ix_timesheets_employee_id", "employee_id"),
        Index("ix_timesheets_decided_by_employee_id", "decided_by_employee_id"),
        CheckConstraint(
            "status IN ('Draft', 'Submitted', 'Approved', 'Rejected')",
            name="ck_timesheets_status",
        ),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    employee_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("employees.id", name="fk_timesheets_employee_id"),
    )
    week_start_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), server_default=text("'Draft'"))
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    decided_by_employee_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("employees.id", name="fk_timesheets_decided_by_employee_id"),
        nullable=True,
    )
    decided_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    rejection_comment: Mapped[str | None] = mapped_column(String(255), nullable=True)

    items: Mapped[list[TimesheetItem]] = relationship(
        back_populates="timesheet",
        cascade="all, delete-orphan",
        order_by="TimesheetItem.sort_order",
    )


class TimesheetItem(Base):
    """One grid row under a week. Replaces TIMESHEET_LINE."""

    __tablename__ = "timesheet_items"
    __table_args__ = (
        Index("ix_timesheet_items_timesheet_id", "timesheet_id"),
        Index("ix_timesheet_items_project_id", "project_id"),
        Index("ix_timesheet_items_leave_type_id", "leave_type_id"),
        # Option B: Allocated Projects | On Leave | Other.
        # Internal vs client project comes from projects/clients (project_id), not category.
        CheckConstraint(
            "category IN ('Allocated Projects', 'On Leave', 'Other')",
            name="ck_timesheet_items_category",
        ),
        CheckConstraint(
            "(category <> 'Allocated Projects') "
            "OR (project_id IS NOT NULL AND activity_type IS NOT NULL "
            "AND leave_type_id IS NULL AND other_type IS NULL)",
            name="ck_timesheet_items_project_fields",
        ),
        CheckConstraint(
            "(category <> 'On Leave') OR (leave_type_id IS NOT NULL "
            "AND project_id IS NULL AND activity_type IS NULL AND other_type IS NULL)",
            name="ck_timesheet_items_leave_fields",
        ),
        CheckConstraint(
            "(category <> 'Other') OR (other_type IS NOT NULL "
            "AND project_id IS NULL AND activity_type IS NULL AND leave_type_id IS NULL)",
            name="ck_timesheet_items_other_fields",
        ),
        CheckConstraint(
            "other_type IS NULL OR other_type IN "
            "('Research', 'Learning', 'Conference', 'Client Meeting', 'Custom')",
            name="ck_timesheet_items_other_type",
        ),
        # Custom free text lives in other_comment (max 128 chars on the column).
        CheckConstraint(
            "other_type IS DISTINCT FROM 'Custom' OR other_comment IS NOT NULL",
            name="ck_timesheet_items_other_comment",
        ),
        CheckConstraint(
            "activity_type IS NULL OR activity_type IN ('Development', 'Testing', 'Documentation')",
            name="ck_timesheet_items_activity_type",
        ),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    timesheet_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(
            "timesheets.id",
            name="fk_timesheet_items_timesheet_id",
            ondelete="CASCADE",
        ),
    )
    category: Mapped[str] = mapped_column(String(40))
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("projects.id", name="fk_timesheet_items_project_id"),
        nullable=True,
    )
    activity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    leave_type_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("leave_types.id", name="fk_timesheet_items_leave_type_id"),
        nullable=True,
    )
    other_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    other_comment: Mapped[str | None] = mapped_column(String(128), nullable=True)
    billable: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    sort_order: Mapped[int] = mapped_column(Integer, server_default=text("0"))

    timesheet: Mapped[Timesheet] = relationship(back_populates="items")
    day_entries: Mapped[list[TimesheetDayEntry]] = relationship(
        back_populates="timesheet_item",
        cascade="all, delete-orphan",
    )


class TimesheetDayEntry(Base):
    """Hours + comment for one item on one date. Replaces TIMESHEET_ENTRY."""

    __tablename__ = "timesheet_day_entries"
    __table_args__ = (
        UniqueConstraint(
            "timesheet_item_id",
            "work_date",
            name="uq_timesheet_day_entries_item_date",
        ),
        Index("ix_timesheet_day_entries_work_date", "work_date"),
        CheckConstraint("hours >= 0", name="ck_timesheet_day_entries_hours_nonneg"),
        # Per-cell cap; day total across all lines is enforced in the service (max 24).
        CheckConstraint("hours <= 24", name="ck_timesheet_day_entries_hours_max"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    timesheet_item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(
            "timesheet_items.id",
            name="fk_timesheet_day_entries_timesheet_item_id",
            ondelete="CASCADE",
        ),
    )
    work_date: Mapped[date] = mapped_column(Date)
    hours: Mapped[Decimal] = mapped_column(
        Numeric(4, 2), server_default=text("0")
    )
    comment: Mapped[str | None] = mapped_column(String(255), nullable=True)

    timesheet_item: Mapped[TimesheetItem] = relationship(back_populates="day_entries")


# ---------------------------------------------------------------------------
# Leave (3)
# ---------------------------------------------------------------------------


class LeaveRequest(Base):
    """One leave application. Stays its own table (not employee_requests)."""

    __tablename__ = "leave_requests"
    __table_args__ = (
        Index("ix_leave_requests_employee_id", "employee_id"),
        Index("ix_leave_requests_leave_type_id", "leave_type_id"),
        Index("ix_leave_requests_status", "status"),
        Index("ix_leave_requests_from_to", "from_date", "to_date"),
        Index("ix_leave_requests_decided_by_employee_id", "decided_by_employee_id"),
        CheckConstraint(
            "from_date <= to_date",
            name="ck_leave_requests_date_range",
        ),
        CheckConstraint(
            "status IN ('Pending', 'Approved', 'Rejected', 'Recalled')",
            name="ck_leave_requests_status",
        ),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    employee_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("employees.id", name="fk_leave_requests_employee_id"),
    )
    leave_type_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("leave_types.id", name="fk_leave_requests_leave_type_id"),
    )
    from_date: Mapped[date] = mapped_column(Date)
    to_date: Mapped[date] = mapped_column(Date)
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20))
    recalled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    decided_by_employee_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("employees.id", name="fk_leave_requests_decided_by_employee_id"),
        nullable=True,
    )
    decided_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    rejection_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)

    days: Mapped[list[LeaveRequestDay]] = relationship(
        back_populates="leave_request",
        cascade="all, delete-orphan",
    )


class LeaveRequestDay(Base):
    """One calendar day on a leave request. Queried by leave_date."""

    __tablename__ = "leave_request_days"
    __table_args__ = (
        UniqueConstraint(
            "leave_request_id",
            "leave_date",
            "half_part",
            name="uq_leave_request_days_request_date_half",
        ),
        Index("ix_leave_request_days_leave_date", "leave_date"),
        CheckConstraint(
            "half_part IN ('full', 'first', 'second')",
            name="ck_leave_request_days_half_part",
        ),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    leave_request_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(
            "leave_requests.id",
            name="fk_leave_request_days_leave_request_id",
            ondelete="CASCADE",
        ),
    )
    leave_date: Mapped[date] = mapped_column(Date)
    # Always set. Use 'full' for a whole day; 'first' / 'second' for halves.
    # full cannot coexist with first/second on the same request+date (see trigger below).
    half_part: Mapped[str] = mapped_column(
        String(6), server_default=text("'full'")
    )

    leave_request: Mapped[LeaveRequest] = relationship(back_populates="days")


# Stops balance over-count: full + first/second on the same leave_request_id + leave_date.
# first + second on the same day is allowed (1.0 total). Installed by create_all and schema_ensure.
LEAVE_DAY_HALF_EXCLUSION_SQL = (
    """CREATE OR REPLACE FUNCTION leave_request_days_block_full_with_halves() RETURNS trigger AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM leave_request_days d
        WHERE d.leave_request_id = NEW.leave_request_id
          AND d.leave_date = NEW.leave_date
          AND d.id IS DISTINCT FROM NEW.id
          AND (
                (NEW.half_part = 'full' AND d.half_part IN ('first', 'second'))
             OR (NEW.half_part IN ('first', 'second') AND d.half_part = 'full')
          )
    ) THEN
        RAISE EXCEPTION USING
            MESSAGE = 'leave day cannot mix full with first/second on the same date',
            ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql""",
    "DROP TRIGGER IF EXISTS trg_leave_request_days_no_full_with_halves ON leave_request_days",
    """CREATE TRIGGER trg_leave_request_days_no_full_with_halves
    BEFORE INSERT OR UPDATE OF leave_request_id, leave_date, half_part ON leave_request_days
    FOR EACH ROW EXECUTE FUNCTION leave_request_days_block_full_with_halves()""",
)

for _statement in LEAVE_DAY_HALF_EXCLUSION_SQL:
    event.listen(LeaveRequestDay.__table__, "after_create", DDL(_statement))


class EmployeeLeaveBalance(Base):
    """Yearly grant snapshot: entitled + carried only.

    used_days / remaining_days are not stored. Use EMPLOYEE_LEAVE_BALANCE_VIEW_SQL
    (at the bottom of this file) in a migration, and lock open leave rows for
    the employee when approving so two concurrent approvals cannot overdraw.
    """

    __tablename__ = "employee_leave_balances"
    __table_args__ = (
        UniqueConstraint(
            "employee_id",
            "leave_type_id",
            "leave_year",
            name="uq_employee_leave_balances_employee_type_year",
        ),
        Index("ix_employee_leave_balances_leave_type_id", "leave_type_id"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    employee_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("employees.id", name="fk_employee_leave_balances_employee_id"),
    )
    leave_type_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("leave_types.id", name="fk_employee_leave_balances_leave_type_id"),
    )
    leave_year: Mapped[int] = mapped_column(SmallInteger)
    entitled_days: Mapped[Decimal] = mapped_column(Numeric(5, 1))
    carried_forward_days: Mapped[Decimal] = mapped_column(
        Numeric(5, 1), server_default=text("0")
    )


# ---------------------------------------------------------------------------
# Requests (1) — profile_update | asset | correction
# ---------------------------------------------------------------------------


class EmployeeRequest(Base):
    """Merged PROFILE_UPDATE_REQUEST + ASSET_REQUEST + CORRECTION_REQUEST.

    IT_REQUEST stays its own live table and is not stored here.
    """

    __tablename__ = "employee_requests"
    # Single-table inheritance on request_kind: app/models/employee_requests.py maps one subclass per kind
    # (ProfileUpdateRequest / AssetRequest / CorrectionRequest). No schema change.
    __mapper_args__ = {"polymorphic_on": "request_kind"}
    __table_args__ = (
        # Only indexes for current list/filter screens; add more when those queries exist.
        Index("ix_employee_requests_kind_status", "request_kind", "status"),
        Index("ix_employee_requests_requested_for", "requested_for_employee_id"),
        Index("ix_employee_requests_status_requested_at", "status", "requested_at"),
        CheckConstraint(
            "request_kind IN ('profile_update', 'asset', 'correction')",
            name="ck_employee_requests_kind",
        ),
        CheckConstraint(
            "(request_kind <> 'profile_update') OR (field_name IS NOT NULL)",
            name="ck_employee_requests_profile_fields",
        ),
        CheckConstraint(
            "(request_kind <> 'asset') OR (asset_request_type IS NOT NULL)",
            name="ck_employee_requests_asset_fields",
        ),
        CheckConstraint(
            "(request_kind <> 'correction') OR (field_name IS NOT NULL AND new_value IS NOT NULL)",
            name="ck_employee_requests_correction_fields",
        ),
        CheckConstraint(
            "(status <> 'Completed') OR (request_kind IN ('profile_update', 'asset'))",
            name="ck_employee_requests_completed_kinds",
        ),
        CheckConstraint(
            "status IN ('Open', 'Approved', 'Rejected', 'Completed')",
            name="ck_employee_requests_status",
        ),
        CheckConstraint(
            "asset_request_type IS NULL OR asset_request_type IN "
            "('new', 'swap', 'reportLostStolen')",
            name="ck_employee_requests_asset_request_type",
        ),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    request_kind: Mapped[str] = mapped_column(String(20))
    requested_for_employee_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("employees.id", name="fk_employee_requests_requested_for_employee_id"),
    )
    submitted_by_employee_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("employees.id", name="fk_employee_requests_submitted_by_employee_id"),
    )
    status: Mapped[str] = mapped_column(String(20), server_default=text("'Open'"))
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Profile + correction
    field_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    attachment_object_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    attachment_file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Asset
    asset_request_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    asset_category_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("asset_categories.id", name="fk_employee_requests_asset_category_id"),
        nullable=True,
    )
    os_platform: Mapped[str | None] = mapped_column(String(50), nullable=True)
    preferred_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    asset_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("assets.id", name="fk_employee_requests_asset_id"),
        nullable=True,
    )
    fulfilled_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("assets.id", name="fk_employee_requests_fulfilled_asset_id"),
        nullable=True,
    )

    # Completion (profile "other" notes / asset fulfillment)
    completion_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_by_employee_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("employees.id", name="fk_employee_requests_completed_by_employee_id"),
        nullable=True,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Decision
    decided_by_employee_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("employees.id", name="fk_employee_requests_decided_by_employee_id"),
        nullable=True,
    )
    decided_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    decision_note: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Resubmit chain: new row points at the rejected row it replaces
    resubmitted_from_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey(
            "employee_requests.id",
            name="fk_employee_requests_resubmitted_from_id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    __mapper_args__ = {
        "polymorphic_on": "request_kind",
    }


# ---------------------------------------------------------------------------
# Balance view SQL (create in a migration — not an ORM table)
# ---------------------------------------------------------------------------

EMPLOYEE_LEAVE_BALANCE_VIEW_SQL = """
CREATE OR REPLACE VIEW employee_leave_balance_view AS
SELECT
    b.id,
    b.employee_id,
    b.leave_type_id,
    b.leave_year,
    b.entitled_days,
    b.carried_forward_days,
    COALESCE(u.used_days, 0) AS used_days,
    (b.entitled_days + b.carried_forward_days - COALESCE(u.used_days, 0)) AS remaining_days
FROM employee_leave_balances b
LEFT JOIN (
    SELECT
        lr.employee_id,
        lr.leave_type_id,
        EXTRACT(YEAR FROM d.leave_date)::smallint AS leave_year,
        SUM(
            CASE d.half_part
                WHEN 'full' THEN 1.0
                WHEN 'first' THEN 0.5
                WHEN 'second' THEN 0.5
                ELSE 0
            END
        ) AS used_days
    FROM leave_request_days d
    JOIN leave_requests lr ON lr.id = d.leave_request_id
    WHERE lr.status = 'Approved'
    GROUP BY lr.employee_id, lr.leave_type_id, EXTRACT(YEAR FROM d.leave_date)
) u
  ON u.employee_id = b.employee_id
 AND u.leave_type_id = b.leave_type_id
 AND u.leave_year = b.leave_year;
"""
