"""Shared helpers for the schema tests: connect to a LOCAL Postgres with asyncpg (the backend's own driver),
create and drop throwaway databases, and build one from the SQLAlchemy models.

Connection settings come from the same environment variables psql uses:
    PGHOST (default: the local socket folder, else localhost), PGPORT (default 5432),
    PGUSER (default: your own user), PGPASSWORD (only if your local Postgres asks for one).
Nothing is stored in the repository. Two safety rules are enforced here:
    - the host must be this machine (a socket folder, localhost, 127.0.0.1 or ::1), never a shared server;
    - only the four throwaway names below can be created or dropped.
"""
import getpass
import os
import sys
from pathlib import Path

import asyncpg

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))  # the repository root, so `app` can be imported

THROWAWAY = (
    "hrms_test", "hrms_perf", "hrms_atomic", "hrms_race", "hrms_log", "hrms_seed",
    "hrms_portal_atomic", "hrms_portal_race", "hrms_portal_perf",
)

# The tables the tests build. Add the tables of your module here. When every module's models build together,
# replace this list with Base.metadata.create_all (no `tables=`).
TABLES = ["locations", "companies", "departments", "designations", "leave_types", "leave_policies",
          "leave_policy_lines", "company_holidays", "email_deliveries", "asset_categories",
          "asset_category_os_platforms", "assets", "asset_assignments", "activity_log",
          "employees", "national_id_document_types", "addresses", "emergency_contacts",
          "employee_onboarding_packet_documents", "skills", "employee_skills",
          "modules", "submodules", "employee_access_grants",
          "clients", "client_locations", "projects", "project_members", "project_stakeholders", "allocations",
          "timesheets", "timesheet_items", "timesheet_day_entries",
          "leave_requests", "leave_request_days", "employee_leave_balances", "employee_requests"]


def _host():
    host = os.environ.get("PGHOST") or ("/var/run/postgresql" if Path("/var/run/postgresql").exists() else "localhost")
    if not (host.startswith("/") or host in ("localhost", "127.0.0.1", "::1")):
        sys.exit(f"refusing to run: PGHOST={host!r} is not this machine. These tests only run on a local Postgres.")
    return host


async def connect(db):
    return await asyncpg.connect(host=_host(), port=int(os.environ.get("PGPORT", "5432")),
                                 user=os.environ.get("PGUSER", getpass.getuser()), database=db)


def _check_name(db):
    if db not in THROWAWAY:
        sys.exit(f"refusing to touch database {db!r}: only {', '.join(THROWAWAY)} may be created or dropped")


async def create_database(db):
    _check_name(db)
    admin = await connect("postgres")
    try:
        await admin.execute(f"DROP DATABASE IF EXISTS {db}")
        await admin.execute(f"CREATE DATABASE {db}")
    finally:
        await admin.close()


async def drop_database(db):
    _check_name(db)
    admin = await connect("postgres")
    try:
        await admin.execute(f"DROP DATABASE IF EXISTS {db}")
    finally:
        await admin.close()


def make_engine(db):
    """A SQLAlchemy async engine on the same local connection settings."""
    from sqlalchemy.ext.asyncio import create_async_engine

    return create_async_engine("postgresql+asyncpg://", async_creator=lambda: connect(db))


async def build(db):
    """Drop and create the throwaway database `db`, then create the tables from the models."""
    from app.models import Base

    await create_database(db)
    engine = make_engine(db)
    tables = [Base.metadata.tables[name] for name in TABLES]
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=tables))
    await engine.dispose()
