"""Schema ensure for the 37-table snake_case schema (no legacy UPPERCASE auto-SQL)."""

from app.db.embedded_sql import EMBEDDED_SQL, LEGACY_RENAME_SQL_KEYS, SKILLS_CATALOG_SQL_KEY
from app.db.schema_ensure import (
    EMPLOYEE_ADDED_COLUMNS_SQL,
    LEAVE_TYPES_SEED_SQL,
    ensure_schema,
    ensure_schema_and_seed,
)
from app.db.sql_split import split_sql


def test_leave_types_seed_sql_covers_six_names() -> None:
    for name in (
        "Personal Leave",
        "Sick Leave",
        "Maternity Leave",
        "Paternity Leave",
        "Medical Leave",
        "Unpaid Leave",
    ):
        assert name in LEAVE_TYPES_SEED_SQL


def test_employee_added_columns_are_idempotent_alters() -> None:
    assert EMPLOYEE_ADDED_COLUMNS_SQL
    assert any("entra_oid" in stmt for stmt in EMPLOYEE_ADDED_COLUMNS_SQL)
    assert all("IF NOT EXISTS" in stmt or "CREATE UNIQUE INDEX" in stmt for stmt in EMPLOYEE_ADDED_COLUMNS_SQL)


def test_ensure_schema_callables_exported() -> None:
    assert callable(ensure_schema)
    assert callable(ensure_schema_and_seed)


def test_embedded_sql_keys_still_present_for_reference() -> None:
    """Legacy rename scripts remain embedded for reference; startup does not apply them."""
    for key in LEGACY_RENAME_SQL_KEYS:
        assert key in EMBEDDED_SQL
    assert SKILLS_CATALOG_SQL_KEY in EMBEDDED_SQL


def test_split_sql_handles_embedded_client_rename() -> None:
    sql = EMBEDDED_SQL["client-rename-from-customer.sql"]
    statements = split_sql(sql)
    assert any('RENAME TO "CLIENT"' in stmt for stmt in statements)
    assert any("CLIENT_STAKEHOLDER" in stmt for stmt in statements)


def test_split_sql_splits_simple_statements() -> None:
    sql = """
    -- ignored
    ALTER TABLE "A" DROP COLUMN IF EXISTS "X";
    ALTER TABLE "B" DROP COLUMN IF EXISTS "Y";
    """
    assert split_sql(sql) == [
        'ALTER TABLE "A" DROP COLUMN IF EXISTS "X"',
        'ALTER TABLE "B" DROP COLUMN IF EXISTS "Y"',
    ]
