"""Clients and Projects: clients, client locations, projects, project members, project stakeholders, allocations.
History goes to activity_log. Nothing cascades: a parent that still has children cannot be deleted."""
import datetime as dt
import uuid
from decimal import Decimal

from sqlalchemy import (
    DDL, Boolean, CheckConstraint, Date, FetchedValue, ForeignKey, Index, Numeric, Sequence, String, Text,
    UniqueConstraint, event, func, text,
)
from sqlalchemy.orm import Mapped, mapped_column, validates

from app.models.base import Base, uuid_pk
from app.models.employee_master import Address

# Company-wide running numbers for clients.client_code (CLI1001) and projects.project_number (PRJ1001). Only the
# guard triggers take numbers; a value sent by the caller is refused. Gaps (from a rolled-back save) are fine; a
# number is never reused.
client_code_seq = Sequence("client_code_seq", start=1001, metadata=Base.metadata)
project_number_seq = Sequence("project_number_seq", start=1001, metadata=Base.metadata)


class Client(Base):
    """Archived by setting status to INACTIVE. client_code is set by the database on insert and never changes
    (trg_clients_guard)."""
    __tablename__ = "clients"
    __table_args__ = (
        UniqueConstraint("client_code", name="uq_clients_client_code"),
        CheckConstraint("client_category IN ('INTERNAL', 'DIRECT', 'INTERMEDIARY')", name="ck_clients_category"),
        CheckConstraint("status IN ('ACTIVE', 'INACTIVE')", name="ck_clients_status"),
        # \S: a character that is not a space, tab or line break. The name must start and end with one, so it is not
        # blank and 'Acme ' cannot slip past uq_clients_active_name beside 'Acme'.
        CheckConstraint(r"client_name ~ '^\S(.*\S)?$'", name="ck_clients_name_trimmed"),
        # No two active clients share a name, ignoring capital letters. Inactive ones may.
        Index("uq_clients_active_name", func.lower(text("client_name")), unique=True,
              postgresql_where=text("status = 'ACTIVE'")),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    client_code: Mapped[str] = mapped_column(String(16), server_default=FetchedValue())
    client_name: Mapped[str] = mapped_column(String(100))
    industry: Mapped[str | None] = mapped_column(String(50))
    account_owner: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("employees.id", name="fk_clients_account_owner"))
    client_category: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(10), server_default=text("'ACTIVE'"))
    logo_object_key: Mapped[str | None] = mapped_column(String(255))


class ClientLocation(Base):
    """Either an office pick (Internal clients) or a typed address (Direct and Intermediary clients), never both.
    The category match is checked by trg_client_locations_guard."""
    __tablename__ = "client_locations"
    __table_args__ = (
        CheckConstraint(
            "(office_location_id IS NOT NULL AND address_line_1 IS NULL AND address_line_2 IS NULL AND city IS NULL "
            "AND state_province IS NULL AND zip IS NULL AND country IS NULL) "
            "OR (office_location_id IS NULL AND address_line_1 IS NOT NULL AND country IS NOT NULL)",
            name="ck_client_locations_office_or_typed"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    client_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clients.id", name="fk_client_locations_client_id"))
    office_location_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("locations.id", name="fk_client_locations_office_location_id"))
    location_name: Mapped[str | None] = mapped_column(String(100))
    address_line_1: Mapped[str | None] = mapped_column(String(255))
    address_line_2: Mapped[str | None] = mapped_column(String(255))
    city: Mapped[str | None] = mapped_column(String(100))
    state_province: Mapped[str | None] = mapped_column(String(100))
    zip: Mapped[str | None] = mapped_column(String(20))
    country: Mapped[str | None] = mapped_column(String(100))


class Project(Base):
    """project_number is set by the database on insert and never changes. project_code is typed by the user, optional,
    editable, stored in capitals. end_customer_name is only for an Intermediary client (trg_projects_guard)."""
    __tablename__ = "projects"
    __table_args__ = (
        UniqueConstraint("project_number", name="uq_projects_project_number"),
        # Several projects may have no code.
        UniqueConstraint("project_code", name="uq_projects_project_code"),
        CheckConstraint("project_code ~ '^[A-Z0-9]{1,8}$'", name="ck_projects_project_code"),
        CheckConstraint(r"name ~ '^\S(.*\S)?$'", name="ck_projects_name_trimmed"),
        CheckConstraint("region IN ('NA', 'EMEA', 'APAC', 'LATAM')", name="ck_projects_region"),
        CheckConstraint("status IN ('ACTIVE', 'ON_HOLD', 'CLOSED')", name="ck_projects_status"),
        CheckConstraint("planned_end_date IS NULL OR planned_end_date >= start_date", name="ck_projects_planned_end"),
        CheckConstraint("actual_end_date IS NULL OR actual_end_date >= start_date", name="ck_projects_actual_end"),
        Index("ix_projects_client_id", "client_id"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    project_number: Mapped[str] = mapped_column(String(16), server_default=FetchedValue())
    project_code: Mapped[str | None] = mapped_column(String(8))
    client_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clients.id", name="fk_projects_client_id"))
    name: Mapped[str] = mapped_column(String(100))
    project_type: Mapped[str | None] = mapped_column(String(30))
    region: Mapped[str | None] = mapped_column(String(6))
    billing_type: Mapped[str | None] = mapped_column(String(20))
    end_customer_name: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(10), server_default=text("'ACTIVE'"))
    start_date: Mapped[dt.date] = mapped_column(Date)
    planned_end_date: Mapped[dt.date | None] = mapped_column(Date)
    actual_end_date: Mapped[dt.date | None] = mapped_column(Date)
    description: Mapped[str | None] = mapped_column(Text)

    @validates("project_code")
    def _project_code_in_capitals(self, key: str, value: str | None) -> str | None:
        # The trigger stores capitals; this keeps the loaded object equal to the saved row.
        return value.upper() if value else value


class ProjectMember(Base):
    """Account owners and project managers. One employee may hold both roles on a project."""
    __tablename__ = "project_members"
    __table_args__ = (
        # Starts with project_id, so it also serves "members of a project".
        UniqueConstraint("project_id", "employee_id", "role", name="uq_project_members_project_employee_role"),
        CheckConstraint("role IN ('ACCOUNT_OWNER', 'PROJECT_MANAGER')", name="ck_project_members_role"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", name="fk_project_members_project_id"))
    employee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employees.id", name="fk_project_members_employee_id"))
    role: Mapped[str] = mapped_column(String(20))


class ProjectStakeholder(Base):
    """Free text, not linked to employees."""
    __tablename__ = "project_stakeholders"
    __table_args__ = (CheckConstraint(r"name ~ '^\S(.*\S)?$'", name="ck_project_stakeholders_name_trimmed"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", name="fk_project_stakeholders_project_id"))
    name: Mapped[str] = mapped_column(String(100))
    title: Mapped[str | None] = mapped_column(String(100))
    department: Mapped[str | None] = mapped_column(String(100))
    email: Mapped[str | None] = mapped_column(String(100))
    phone_number: Mapped[str | None] = mapped_column(String(40))


class Allocation(Base):
    """One employee on one project for a period. Works from at most one place: a location of the project's client,
    a company office, or the employee's own address (the last two are checked by trg_allocations_guard)."""
    __tablename__ = "allocations"
    __table_args__ = (
        CheckConstraint("allocation_percentage BETWEEN 0.01 AND 100", name="ck_allocations_percentage"),
        CheckConstraint(
            "(is_billable AND billable_percentage IS NOT NULL) OR (NOT is_billable AND billable_percentage IS NULL)",
            name="ck_allocations_billable"),
        CheckConstraint(
            "billable_percentage IS NULL OR (billable_percentage > 0 AND billable_percentage <= allocation_percentage)",
            name="ck_allocations_billable_max"),
        CheckConstraint("end_date IS NULL OR end_date >= start_date", name="ck_allocations_dates"),
        CheckConstraint("num_nonnulls(client_location_id, work_office_location_id, work_address_id) <= 1",
                        name="ck_allocations_one_work_place"),
        Index("ix_allocations_project_id", "project_id"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", name="fk_allocations_project_id"))
    employee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employees.id", name="fk_allocations_employee_id"))
    role_on_project: Mapped[str | None] = mapped_column(String(50))
    allocation_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    is_billable: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    billable_percentage: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    start_date: Mapped[dt.date] = mapped_column(Date)
    end_date: Mapped[dt.date | None] = mapped_column(Date)
    client_location_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("client_locations.id", name="fk_allocations_client_location_id"))
    work_office_location_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("locations.id", name="fk_allocations_work_office_location_id"))
    work_address_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("addresses.id", name="fk_allocations_work_address_id"))


# Rules that need a second table. A parent row is read FOR SHARE, so a concurrent change to it (a client's category,
# a project's client, an address's employee) waits until this transaction ends and cannot slip past the check.
# An unknown parent is left to its foreign key. One statement each: installed by create_all (after_create below)
# and again, harmlessly, by schema_ensure.
CLIENTS_PROJECTS_SQL: dict[str, tuple[str, ...]] = {
    "clients": (
        """CREATE OR REPLACE FUNCTION clients_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.client_code IS NOT NULL THEN
            RAISE EXCEPTION USING MESSAGE = 'client_code is generated by the database and cannot be supplied',
                                  ERRCODE = '23514';
        END IF;
        NEW.client_code := 'CLI' || nextval('client_code_seq');
        RETURN NEW;
    END IF;
    IF NEW.client_code IS DISTINCT FROM OLD.client_code THEN
        RAISE EXCEPTION USING MESSAGE = 'client_code cannot be changed once the client is created', ERRCODE = '23514';
    END IF;
    IF NEW.client_category IS DISTINCT FROM OLD.client_category THEN
        IF EXISTS (SELECT 1 FROM client_locations WHERE client_id = NEW.id
                   AND (office_location_id IS NOT NULL) <> (NEW.client_category = 'INTERNAL')) THEN
            RAISE EXCEPTION USING MESSAGE = 'the new client category does not match the client''s existing locations',
                                  ERRCODE = '23514';
        END IF;
        IF NEW.client_category <> 'INTERMEDIARY' AND EXISTS (
            SELECT 1 FROM projects WHERE client_id = NEW.id AND end_customer_name IS NOT NULL) THEN
            RAISE EXCEPTION USING MESSAGE = 'only a project of an Intermediary client can have an end customer name',
                                  ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql""",
        "DROP TRIGGER IF EXISTS trg_clients_guard ON clients",
        """CREATE TRIGGER trg_clients_guard BEFORE INSERT OR UPDATE OF client_code, client_category ON clients
    FOR EACH ROW EXECUTE FUNCTION clients_guard()""",
    ),
    "client_locations": (
        """CREATE OR REPLACE FUNCTION client_locations_guard() RETURNS trigger AS $$
DECLARE
    category text;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.client_id IS DISTINCT FROM OLD.client_id THEN
        RAISE EXCEPTION USING MESSAGE = 'a client location cannot be moved to another client', ERRCODE = '23514';
    END IF;
    SELECT client_category INTO category FROM clients WHERE id = NEW.client_id FOR SHARE;
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;
    IF category = 'INTERNAL' AND NEW.office_location_id IS NULL THEN
        RAISE EXCEPTION USING MESSAGE = 'an Internal client''s location must be one of the company''s office locations',
                              ERRCODE = '23514';
    END IF;
    IF category <> 'INTERNAL' AND NEW.office_location_id IS NOT NULL THEN
        RAISE EXCEPTION USING MESSAGE = 'a Direct or Intermediary client''s location must be a typed address',
                              ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql""",
        "DROP TRIGGER IF EXISTS trg_client_locations_guard ON client_locations",
        """CREATE TRIGGER trg_client_locations_guard BEFORE INSERT OR UPDATE ON client_locations
    FOR EACH ROW EXECUTE FUNCTION client_locations_guard()""",
    ),
    "projects": (
        """CREATE OR REPLACE FUNCTION projects_guard() RETURNS trigger AS $$
DECLARE
    category text;
BEGIN
    NEW.project_code := upper(NEW.project_code);
    IF TG_OP = 'INSERT' THEN
        IF NEW.project_number IS NOT NULL THEN
            RAISE EXCEPTION USING MESSAGE = 'project_number is generated by the database and cannot be supplied',
                                  ERRCODE = '23514';
        END IF;
        NEW.project_number := 'PRJ' || nextval('project_number_seq');
    ELSE
        IF NEW.project_number IS DISTINCT FROM OLD.project_number THEN
            RAISE EXCEPTION USING MESSAGE = 'project_number cannot be changed once the project is created',
                                  ERRCODE = '23514';
        END IF;
    END IF;
    SELECT client_category INTO category FROM clients WHERE id = NEW.client_id FOR SHARE;
    IF FOUND AND NEW.end_customer_name IS NOT NULL AND category <> 'INTERMEDIARY' THEN
        RAISE EXCEPTION USING MESSAGE = 'only a project of an Intermediary client can have an end customer name',
                              ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.client_id IS DISTINCT FROM OLD.client_id AND EXISTS (
        SELECT 1 FROM allocations a JOIN client_locations cl ON cl.id = a.client_location_id
        WHERE a.project_id = NEW.id AND cl.client_id <> NEW.client_id) THEN
        RAISE EXCEPTION USING MESSAGE = 'allocations of this project use a location of its current client',
                              ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql""",
        "DROP TRIGGER IF EXISTS trg_projects_guard ON projects",
        """CREATE TRIGGER trg_projects_guard
    BEFORE INSERT OR UPDATE OF project_number, project_code, client_id, end_customer_name ON projects
    FOR EACH ROW EXECUTE FUNCTION projects_guard()""",
    ),
    "allocations": (
        """CREATE OR REPLACE FUNCTION allocations_guard() RETURNS trigger AS $$
DECLARE
    project_client uuid;
    location_client uuid;
    address_owner uuid;
BEGIN
    IF NEW.client_location_id IS NOT NULL THEN
        SELECT client_id INTO project_client FROM projects WHERE id = NEW.project_id FOR SHARE;
        SELECT client_id INTO location_client FROM client_locations WHERE id = NEW.client_location_id;
        IF project_client <> location_client THEN
            RAISE EXCEPTION USING MESSAGE = 'an allocation''s client location must belong to the project''s client',
                                  ERRCODE = '23514';
        END IF;
    END IF;
    IF NEW.work_address_id IS NOT NULL THEN
        SELECT employee_id INTO address_owner FROM addresses WHERE id = NEW.work_address_id FOR SHARE;
        IF address_owner <> NEW.employee_id THEN
            RAISE EXCEPTION USING MESSAGE = 'an allocation''s work address must be the allocated employee''s own address',
                                  ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql""",
        "DROP TRIGGER IF EXISTS trg_allocations_guard ON allocations",
        """CREATE TRIGGER trg_allocations_guard
    BEFORE INSERT OR UPDATE OF project_id, employee_id, client_location_id, work_address_id ON allocations
    FOR EACH ROW EXECUTE FUNCTION allocations_guard()""",
    ),
    "addresses": (
        """CREATE OR REPLACE FUNCTION addresses_guard() RETURNS trigger AS $$
BEGIN
    IF NEW.employee_id IS DISTINCT FROM OLD.employee_id
       AND EXISTS (SELECT 1 FROM allocations WHERE work_address_id = NEW.id) THEN
        RAISE EXCEPTION USING MESSAGE = 'an address used by an allocation cannot be moved to another employee',
                              ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql""",
        "DROP TRIGGER IF EXISTS trg_addresses_guard ON addresses",
        """CREATE TRIGGER trg_addresses_guard BEFORE UPDATE OF employee_id ON addresses
    FOR EACH ROW EXECUTE FUNCTION addresses_guard()""",
    ),
}

for _model in (Client, ClientLocation, Project, Allocation, Address):
    for _statement in CLIENTS_PROJECTS_SQL[_model.__tablename__]:
        event.listen(_model.__table__, "after_create", DDL(_statement))
