#!/usr/bin/env python3
"""Create an empty HRMS database from SQLAlchemy models + code ensures.

Schema lives entirely in code:
  - ``app/models/`` (tables)
  - ``app/db/schema_ensure.py`` (additive DDL + embedded legacy SQL)
  - ``app/db/embedded_sql.py`` (one-time rename / skills catalog SQL strings)

There is no ``db/*-patch.sql`` workflow. After ``git pull``, restart the API
(or re-run this script) to apply schema.

Uses DB_* from the backend ``.env``.

From the backend repo root, with the venv active:

    python scripts/bootstrap_db.py

The API creates its own starter data (default company, first admin, document
types, onboarding template, leave types, RBAC catalog) on startup, so this
script only needs to create the database and apply the schema.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import asyncpg

from app.core.config import get_settings
from app.db.schema_ensure import ensure_schema_and_seed
from app.db.session import engine
from app.db.sql_split import split_sql  # noqa: F401  — re-export for unit tests


def _unquote(value: str) -> str:
    text = (value or "").strip()
    if len(text) >= 2 and text[0] == text[-1] and text[0] in {'"', "'"}:
        return text[1:-1]
    return text


async def _connect(settings, database: str) -> asyncpg.Connection:
    return await asyncpg.connect(
        host=_unquote(settings.db_host),
        port=settings.db_port,
        user=_unquote(settings.db_user),
        password=_unquote(settings.db_pass),
        database=_unquote(database),
    )


async def ensure_database(settings) -> None:
    db_name = _unquote(settings.db_name)
    try:
        conn = await _connect(settings, db_name)
        await conn.close()
        return
    except asyncpg.InvalidCatalogNameError:
        print(f'Database "{db_name}" missing — creating it…')
    admin = await _connect(settings, "postgres")
    try:
        await admin.execute(f'CREATE DATABASE "{db_name}"')
    finally:
        await admin.close()


async def apply_schema_from_code() -> None:
    """Same path as API lifespan: create_all → ensure → catalog seeds."""
    print("Applying schema from models (create_all + schema_ensure) …")
    await ensure_schema_and_seed()


async def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create the HRMS database and apply the schema from models/schema_ensure."
    )
    parser.add_argument(
        "--schema-only",
        action="store_true",
        help="Accepted for compatibility (CI uses it); schema is all this script applies",
    )
    parser.parse_args()

    settings = get_settings()
    user = _unquote(settings.db_user)
    db_name = _unquote(settings.db_name)
    print(
        f"Connecting as {user}@{_unquote(settings.db_host)}:{settings.db_port}/{db_name}"
    )
    await ensure_database(settings)
    await apply_schema_from_code()
    print("Schema ready.")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
