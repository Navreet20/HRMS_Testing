#!/usr/bin/env python3
"""Compare the tables and columns in the database with the SQLAlchemy models.

READ-ONLY: it only runs SELECTs against information_schema, inside a read-only
transaction, and never creates, alters or drops anything. Safe to point at the
shared dev database.

Uses DB_* from the backend ``.env`` (same settings the API uses).

From the backend repo root, with the venv active:

    python scripts/check_schema_drift.py

Exit code: 0 = no drift, 1 = drift found, 2 = could not check.

What the sections mean:
  - Missing in DB:      the models expect it, the database does not have it.
                        ``schema_ensure.py`` adds missing tables and columns
                        on the next API start.
  - Extra in DB:        the database has it, no model uses it (left over from
                        an older design). Nothing adds or removes these
                        automatically; removing one is a reviewed manual SQL
                        script.
"""

from __future__ import annotations

import asyncio
import importlib
import pkgutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

import app.models
from app.core.config import get_settings
from app.db.base import Base

SCHEMA = "public"


def model_schema() -> dict[str, set[str]]:
    """Table name -> column names, as the models define them."""
    # Import every module in app.models: not all are re-exported by the package,
    # and a table only exists on Base.metadata once its module is imported.
    for module in pkgutil.iter_modules(app.models.__path__):
        importlib.import_module(f"app.models.{module.name}")
    return {
        table.name: {column.name for column in table.columns}
        for table in Base.metadata.tables.values()
    }


async def database_schema(url: str, ssl: object) -> dict[str, set[str]]:
    """Table name -> column names, as the database has them (SELECT only)."""
    engine = create_async_engine(
        url,
        connect_args={
            "ssl": ssl,
            "timeout": 15,
            "command_timeout": 30,
            # The server itself refuses any write on this connection.
            "server_settings": {"default_transaction_read_only": "on"},
        },
    )
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SET TRANSACTION READ ONLY"))
            rows = await conn.execute(
                text(
                    """
                    SELECT c.table_name, c.column_name
                    FROM information_schema.columns c
                    JOIN information_schema.tables t
                      ON t.table_schema = c.table_schema
                     AND t.table_name = c.table_name
                    WHERE c.table_schema = :schema
                      AND t.table_type = 'BASE TABLE'
                    """
                ),
                {"schema": SCHEMA},
            )
            found: dict[str, set[str]] = {}
            for table_name, column_name in rows:
                found.setdefault(table_name, set()).add(column_name)
            return found
    finally:
        await engine.dispose()


def compare(
    models: dict[str, set[str]], database: dict[str, set[str]]
) -> tuple[list[str], list[str], dict[str, list[str]], dict[str, list[str]]]:
    missing_tables = sorted(set(models) - set(database))
    extra_tables = sorted(set(database) - set(models))
    missing_columns: dict[str, list[str]] = {}
    extra_columns: dict[str, list[str]] = {}
    for table in sorted(set(models) & set(database)):
        missing = sorted(models[table] - database[table])
        extra = sorted(database[table] - models[table])
        if missing:
            missing_columns[table] = missing
        if extra:
            extra_columns[table] = extra
    return missing_tables, extra_tables, missing_columns, extra_columns


def report(
    models: dict[str, set[str]],
    database: dict[str, set[str]],
) -> bool:
    missing_tables, extra_tables, missing_columns, extra_columns = compare(
        models, database
    )
    print(f"Models: {len(models)} tables. Database: {len(database)} tables.\n")

    print("Missing in DB (models expect them):")
    if not missing_tables and not missing_columns:
        print("  none")
    for table in missing_tables:
        print(f"  table  {table}")
    for table, columns in missing_columns.items():
        print(f"  column {table}: {', '.join(columns)}")

    print("\nExtra in DB (no model uses them):")
    if not extra_tables and not extra_columns:
        print("  none")
    for table in extra_tables:
        print(f"  table  {table}")
    for table, columns in extra_columns.items():
        print(f"  column {table}: {', '.join(columns)}")

    return bool(missing_tables or extra_tables or missing_columns or extra_columns)


def main() -> int:
    settings = get_settings()
    print(
        f"Checking {settings.db_user}@{settings.db_host}:{settings.db_port}"
        f"/{settings.db_name} (read-only)\n"
    )
    try:
        database = asyncio.run(
            database_schema(settings.database_url, settings.db_ssl)
        )
    except Exception as exc:  # noqa: BLE001 — report any connection problem
        print(f"Could not read the database: {exc}", file=sys.stderr)
        return 2
    drift = report(model_schema(), database)
    return 1 if drift else 0


if __name__ == "__main__":
    raise SystemExit(main())
