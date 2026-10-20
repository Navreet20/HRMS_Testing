"""Asset Management: categories, allowed OS per category, assets, assignments. History goes to activity_log.
asset_requests belongs to another module owner and is not here."""
import datetime as dt
import uuid

from sqlalchemy import (
    DDL, Boolean, CheckConstraint, Date, ForeignKey, ForeignKeyConstraint, Index, PrimaryKeyConstraint, Sequence,
    String, Text, UniqueConstraint, event, text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, uuid_pk

# One company-wide running number for asset codes. Gaps (from a rolled-back save) are fine.
asset_number_seq = Sequence("asset_number_seq", metadata=Base.metadata)


class AssetCategory(Base):
    """A fixed list created by the system at startup, so there is no is_active."""
    __tablename__ = "asset_categories"
    __table_args__ = (UniqueConstraint("name", name="uq_asset_categories_name"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(100))
    is_serial_required: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    has_low_stock_tracking: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))


class AssetCategoryOsPlatform(Base):
    """Which OS values a category allows. A category with no rows has no OS field."""
    __tablename__ = "asset_category_os_platforms"
    __table_args__ = (
        PrimaryKeyConstraint("asset_category_id", "os_platform"),
        CheckConstraint("os_platform IN ('Mac', 'Windows', 'iOS', 'Android')", name="ck_asset_category_os_platform"),
    )

    asset_category_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("asset_categories.id", name="fk_asset_category_os_platforms_asset_category_id"))
    os_platform: Mapped[str] = mapped_column(String(10))


# Two rules that must always hold for an asset: it is never deleted (Decommissioned is the end state), and its
# code never changes (the code is printed on a sticker on the device). One statement each: installed by
# create_all (after_create below) and again, harmlessly, by schema_ensure.
ASSET_GUARD_SQL = (
    """CREATE OR REPLACE FUNCTION assets_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION USING MESSAGE = 'assets are never deleted: mark the asset Decommissioned instead', ERRCODE = '23001';
    END IF;
    IF NEW.asset_code IS DISTINCT FROM OLD.asset_code THEN
        RAISE EXCEPTION USING MESSAGE = 'asset_code cannot be changed once the asset is created', ERRCODE = '23001';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql""",
    "DROP TRIGGER IF EXISTS trg_assets_guard ON assets",
    """CREATE TRIGGER trg_assets_guard BEFORE UPDATE OF asset_code OR DELETE ON assets
    FOR EACH ROW EXECUTE FUNCTION assets_guard()""",
)


class Asset(Base):
    """One physical item. Never deleted (Decommissioned is the end state) and its code never changes: both are
    enforced by the trigger trg_assets_guard. 'Assigned' is set and cleared in the same transaction that opens
    or closes an assignment.

    Columns come in groups: identity, hardware, purchase and warranty, the purchase receipt, and status.
    Purchase, warranty and receipt are one value per asset, and the screens show them together, so they stay on
    this table. If an asset may ever have several receipts or documents, move them to a child table instead."""
    __tablename__ = "assets"
    __table_args__ = (
        # --- identity
        UniqueConstraint("asset_code", name="uq_assets_asset_code"),
        # Stops the same device being entered twice.
        Index("uq_assets_serial_number", "serial_number", unique=True, postgresql_where=text("serial_number IS NOT NULL")),
        # --- hardware
        # Skipped when os_platform is NULL. Otherwise the pair must exist in asset_category_os_platforms.
        ForeignKeyConstraint(
            ["asset_category_id", "os_platform"],
            ["asset_category_os_platforms.asset_category_id", "asset_category_os_platforms.os_platform"],
            name="fk_assets_category_os"),
        CheckConstraint("condition IN ('New', 'Good', 'Fair', 'Poor')", name="ck_assets_condition"),
        # --- purchase and warranty
        CheckConstraint(
            "warranty_plan_type IN ('AppleCare / AppleCare+', 'Store / retailer protection', 'Dell ProSupport', "
            "'HP Care Pack', 'Other')",
            name="ck_assets_warranty_plan_type"),
        CheckConstraint(
            "warranty_expiry IS NULL OR purchase_date IS NULL OR warranty_expiry >= purchase_date",
            name="ck_assets_warranty_dates"),
        CheckConstraint(
            "warranty_plan_number IS NULL OR warranty_plan_type IS NOT NULL", name="ck_assets_warranty_plan_number"),
        # --- status
        CheckConstraint(
            "status IN ('In Stock', 'Assigned', 'Under Repair', 'Decommissioned', 'Lost')", name="ck_assets_status"),
        # Category cards (count per status) and the category filter on the list.
        Index("ix_assets_category_status", "asset_category_id", "status"),
    )

    # --- identity
    id: Mapped[uuid.UUID] = uuid_pk()
    # System-generated: companies.asset_code_prefix + '-' + next asset_number_seq value padded to 5 digits.
    asset_code: Mapped[str] = mapped_column(String(40))
    asset_category_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("asset_categories.id", name="fk_assets_asset_category_id"))
    serial_number: Mapped[str | None] = mapped_column(String(100))
    # --- hardware
    model: Mapped[str | None] = mapped_column(String(150))
    os_platform: Mapped[str | None] = mapped_column(String(10))
    condition: Mapped[str | None] = mapped_column(String(10))
    specifications: Mapped[str | None] = mapped_column(Text)
    # --- purchase and warranty
    purchase_date: Mapped[dt.date | None] = mapped_column(Date)
    warranty_expiry: Mapped[dt.date | None] = mapped_column(Date)
    warranty_plan_type: Mapped[str | None] = mapped_column(String(40))
    warranty_plan_number: Mapped[str | None] = mapped_column(String(100))
    # --- purchase receipt: at most one file per asset (uploading again replaces it). The file is in file storage;
    # these two columns hold its storage key and its display name.
    purchase_receipt_object_key: Mapped[str | None] = mapped_column(String(500))
    purchase_receipt_file_name: Mapped[str | None] = mapped_column(String(255))
    # --- status
    status: Mapped[str] = mapped_column(String(15), server_default=text("'In Stock'"))


class AssetAssignment(Base):
    """One row = one asset held by one person for a period. An assignment ends by a return, a swap, or the asset
    being reported lost / stolen."""
    __tablename__ = "asset_assignments"
    __table_args__ = (
        CheckConstraint("returned_date IS NULL OR returned_date >= assigned_date", name="ck_asset_assignments_dates"),
        CheckConstraint(
            "return_reason IN ('Employee terminated', 'Broken', 'Upgrade', 'Other', 'Lost', 'Stolen')",
            name="ck_asset_assignments_reason_values"),
        CheckConstraint(
            "condition_at_return IN ('New', 'Good', 'Fair', 'Poor')", name="ck_asset_assignments_condition_values"),
        # An open assignment has no return details; a closed one has a reason.
        CheckConstraint(
            "(returned_date IS NULL AND return_reason IS NULL AND condition_at_return IS NULL AND return_note IS NULL) "
            "OR (returned_date IS NOT NULL AND return_reason IS NOT NULL)",
            name="ck_asset_assignments_open_or_closed"),
        # Condition is recorded on every return except Lost / Stolen.
        CheckConstraint(
            "returned_date IS NULL "
            "OR (return_reason IN ('Lost', 'Stolen') AND condition_at_return IS NULL) "
            "OR (return_reason NOT IN ('Lost', 'Stolen') AND condition_at_return IS NOT NULL)",
            name="ck_asset_assignments_condition_needed"),
        CheckConstraint(
            "return_reason IS DISTINCT FROM 'Other' OR return_note IS NOT NULL", name="ck_asset_assignments_other_note"),
        # The database itself refuses a second open assignment for one asset.
        Index("uq_asset_assignments_one_open", "asset_id", unique=True, postgresql_where=text("returned_date IS NULL")),
        # Who held this asset, newest first.
        Index("ix_asset_assignments_asset_history", "asset_id", "assigned_date"),
        # Assets an employee holds or held (offboarding, "my assets").
        Index("ix_asset_assignments_employee_history", "assigned_to_employee_id", "assigned_date"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assets.id", name="fk_asset_assignments_asset_id"))
    assigned_to_employee_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("employees.id", name="fk_asset_assignments_assigned_to_employee_id"))
    assigned_date: Mapped[dt.date] = mapped_column(Date)
    returned_date: Mapped[dt.date | None] = mapped_column(Date)
    return_reason: Mapped[str | None] = mapped_column(String(20))
    condition_at_return: Mapped[str | None] = mapped_column(String(10))
    return_note: Mapped[str | None] = mapped_column(String(500))
    replaces_assignment_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("asset_assignments.id", name="fk_asset_assignments_replaces_assignment_id"))


for _statement in ASSET_GUARD_SQL:
    event.listen(Asset.__table__, "after_create", DDL(_statement))
