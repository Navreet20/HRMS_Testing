"""scripts/check_schema_drift.py: comparison logic and read-only guarantee."""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

import os

from app.core.config import get_settings
from app.db.session import engine
from tests.helpers import db as _test_db
from tests.helpers.db import DB_SKIP_REASON

def _live_database_url() -> str:
    """The test database URL, with the host and port of a container started lazily."""
    live = engine.url.set(
        host=os.environ["DB_HOST"], port=int(os.environ["DB_PORT"])
    )
    return live.render_as_string(hide_password=False)


_SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "check_schema_drift.py"
_spec = importlib.util.spec_from_file_location("check_schema_drift", _SCRIPT)
drift = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(drift)


def test_compare_reports_missing_and_extra() -> None:
    models = {"A": {"id", "name"}, "B": {"id"}}
    database = {"A": {"id", "old"}, "C": {"id"}}

    missing_tables, extra_tables, missing_columns, extra_columns = drift.compare(
        models, database
    )

    assert missing_tables == ["B"]
    assert extra_tables == ["C"]
    assert missing_columns == {"A": ["name"]}
    assert extra_columns == {"A": ["old"]}


def test_compare_is_clean_when_identical() -> None:
    same = {"A": {"id", "name"}}
    assert drift.compare(same, same) == ([], [], {}, {})


@pytest.mark.skipif(_test_db.SKIP_DB, reason=DB_SKIP_REASON)
async def test_fresh_test_database_has_no_drift() -> None:
    settings = get_settings()
    database = await drift.database_schema(_live_database_url(), settings.db_ssl)

    assert drift.compare(drift.model_schema(), database) == ([], [], {}, {})


@pytest.mark.skipif(_test_db.SKIP_DB, reason=DB_SKIP_REASON)
async def test_the_check_connection_refuses_writes() -> None:
    settings = get_settings()
    from sqlalchemy.ext.asyncio import create_async_engine

    read_only = create_async_engine(
        _live_database_url(),
        connect_args={
            "ssl": settings.db_ssl,
            "server_settings": {"default_transaction_read_only": "on"},
        },
    )
    try:
        async with read_only.connect() as conn:
            with pytest.raises(DBAPIError):
                await conn.execute(text('CREATE TABLE "DRIFT_CHECK_PROBE" (id int)'))
    finally:
        await read_only.dispose()
    await engine.dispose()
