"""split_sql unit tests (SQL lives in app/db/embedded_sql.py, not db/)."""

from app.db.embedded_sql import EMBEDDED_SQL
from app.db.sql_split import split_sql
from scripts.bootstrap_db import split_sql as bootstrap_split_sql


def test_bootstrap_reexports_split_sql() -> None:
    assert bootstrap_split_sql is split_sql


def test_split_sql_handles_embedded_customer_style_do_blocks() -> None:
    sql = EMBEDDED_SQL["client-rename-from-customer.sql"]
    statements = split_sql(sql)
    assert any(stmt.startswith("DO $$") and stmt.endswith("END $$") for stmt in statements)
    assert any("CLIENT_LOCATION" in stmt for stmt in statements)


def test_split_sql_handles_skills_catalog_data() -> None:
    sql = EMBEDDED_SQL["skills-catalog-data.sql"]
    statements = split_sql(sql)
    assert len(statements) >= 1
    assert any("SKILL" in stmt for stmt in statements)


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
