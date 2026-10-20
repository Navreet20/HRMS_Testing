"""Point the test process at a separate test database, never the shared dev one.

Database tests read only ``TEST_DATABASE_URL``. The app's own ``DB_*`` settings
are always overwritten in the test process, so nothing in ``.env`` can reach the
shared dev database. When the variable is unset, a throwaway Docker Postgres is
started on demand if Docker is available (see ``db_container.py``); otherwise ``DB_*``
point at a closed local port and database tests skip with a clear message.
"""

from __future__ import annotations

import os
from collections.abc import MutableMapping

from sqlalchemy.engine import make_url

from tests.helpers import db_container

DB_SKIP_REASON = (
    "Database tests need a separate test database: set TEST_DATABASE_URL "
    "(e.g. postgresql://user:password@localhost:5432/hrms_test). "
    "They never use the DB_* values from .env. (Docker was not available for an "
    "automatic throwaway test database either.)"
)

_SSL_ON = {"require", "verify-ca", "verify-full", "true", "1"}


def _flag(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes"}


def configure_test_database(environ: MutableMapping[str, str]) -> bool:
    """Set ``DB_*`` in ``environ`` for tests. True when database tests may run."""
    raw = (environ.get("TEST_DATABASE_URL") or "").strip()
    if not raw:
        environ.update(
            DB_HOST="127.0.0.1",
            DB_PORT="1",
            DB_USER="test-db-not-configured",
            DB_PASS="test-db-not-configured",
            DB_NAME="test-db-not-configured",
            DB_SSL="false",
        )
        return False

    url = make_url(raw)
    if not url.database or "test" not in url.database.lower():
        raise RuntimeError(
            "TEST_DATABASE_URL must point at a database whose name contains "
            f"'test' (got {url.database!r}); tests must never use the shared DB."
        )
    ssl = (url.query.get("sslmode") or url.query.get("ssl") or "").lower()
    environ.update(
        DB_HOST=url.host or "localhost",
        DB_PORT=str(url.port or 5432),
        DB_USER=url.username or "",
        DB_PASS=url.password or "",
        DB_NAME=url.database,
        DB_SSL="true" if ssl in _SSL_ON else "false",
    )
    return True


DB_TESTS_ENABLED = False
SKIP_DB = True
CONTAINER_PENDING = False
REQUIRED = False


class DbTestsRequiredError(RuntimeError):
    """REQUIRE_DB_TESTS is set, but the database tests cannot run."""


def check_required(environ: MutableMapping[str, str], enabled: bool) -> None:
    """With REQUIRE_DB_TESTS=1 (used in CI), refuse to run instead of skipping."""
    if not _flag(environ.get("REQUIRE_DB_TESTS")):
        return
    if _flag(environ.get("SKIP_DB_TESTS")):
        why = "SKIP_DB_TESTS is set"
    elif not enabled:
        why = "TEST_DATABASE_URL is not set and no Docker is available"
    else:
        return
    raise DbTestsRequiredError(
        f"REQUIRE_DB_TESTS=1 but the database tests would be skipped ({why}). "
        "Set TEST_DATABASE_URL (CI) or unset REQUIRE_DB_TESTS."
    )


def apply(environ: MutableMapping[str, str] | None = None) -> None:
    """Configure the environment once, before the app is imported."""
    global DB_TESTS_ENABLED, SKIP_DB, CONTAINER_PENDING, REQUIRED
    env = os.environ if environ is None else environ
    if (
        environ is None
        and not (env.get("TEST_DATABASE_URL") or "").strip()
        and not _flag(env.get("SKIP_DB_TESTS"))
    ):
        if db_container.possible():
            env["TEST_DATABASE_URL"] = db_container.pending_url()
            CONTAINER_PENDING = True  # placeholder URL; container starts on first DB test
    DB_TESTS_ENABLED = configure_test_database(env)
    SKIP_DB = _flag(env.get("SKIP_DB_TESTS")) or not DB_TESTS_ENABLED
    REQUIRED = _flag(env.get("REQUIRE_DB_TESTS"))
    check_required(env, DB_TESTS_ENABLED)
