"""Shared pytest fixtures and path-based test-type markers."""

# Database tests run only against TEST_DATABASE_URL (see tests/helpers/db.py).
# DB_* from .env is overwritten for the test process so the shared dev database
# can never be reached; with the variable unset, database tests skip.

from __future__ import annotations

import os
from pathlib import Path
from unittest.mock import AsyncMock

import pytest

# Database tests use TEST_DATABASE_URL only; DB_* from .env is always overwritten.
from tests.helpers import db as test_db  # noqa: E402
from tests.helpers import db_container  # noqa: E402

try:
    test_db.apply()
except test_db.DbTestsRequiredError as exc:
    pytest.exit(str(exc), returncode=3)

# MINIO_* is always overwritten too, so tests never touch real object storage.
from tests.helpers.storage import force_test_storage  # noqa: E402

force_test_storage()

os.environ.setdefault("TESTING", "1")
# Auth tests sign in as an allowlisted Superadmin; do not rely on seeded users.
os.environ.setdefault("SUPERADMIN_EMAILS", "developer@example.com")
os.environ.setdefault("ENVIRONMENT", "development")
# Entra settings required by Settings (OIDC calls are mocked in unit tests).
os.environ.setdefault("TENANT_ID", "00000000-0000-0000-0000-000000000001")
os.environ.setdefault("CLIENT_ID", "00000000-0000-0000-0000-000000000002")
os.environ.setdefault("CLIENT_SECRET", "test-entra-client-secret")
os.environ.setdefault(
    "REDIRECT_URI", "http://test/api/v1/auth/entra/callback"
)
os.environ.setdefault("MSAL_REDIRECT_URI", "http://localhost:3000")
os.environ.setdefault("SCOPES", "openid profile email User.Read")
os.environ.setdefault("SMTP_ENABLED", "true")
os.environ.setdefault("SMTP_HOST", "smtp.test.local")
os.environ.setdefault("SMTP_PORT", "587")
os.environ.setdefault("SMTP_USER", "test@smtp.test.local")
os.environ.setdefault("SMTP_PASS", "test-smtp-pass")
os.environ.setdefault("SMTP_FROM_EMAIL", "noreply@example.com")
os.environ.setdefault("SMTP_FROM_NAME", "EAOVA")
os.environ.setdefault("APP_PUBLIC_URL", "http://localhost:3001")
# Everything else Settings requires. Test values only; DB_*, JWT_SECRET and
# DB_SSL are left to .env locally and to the CI workflow.
_TEST_ENV = {
    "PORT": "5001",
    "DB_POOL_CLASS": "queue",
    "DB_POOL_SIZE": "2",
    "DB_MAX_OVERFLOW": "2",
    "DB_POOL_PRE_PING": "true",
    "DB_POOL_RECYCLE": "280",
    "DB_POOL_TIMEOUT": "30",
    "JWT_ALGORITHM": "HS256",
    "JWT_EXPIRE_MINUTES": "480",
    "CORS_ORIGINS": "http://localhost:3000,http://127.0.0.1:3000",
    "COOKIE_SECURE": "false",
    "COOKIE_SAMESITE": "lax",
    "COOKIE_DOMAIN": "",
    "FIELD_ENCRYPTION_KEY": "",
    "ONBOARDING_SEND_INVITE_EMAIL": "false",
    "AUTH_BYPASS": "false",
    "EMAIL_PROVIDER": "smtp",
    "NOTIFICATION_WORKER_ENABLED": "false",
    "NOTIFICATION_POLL_SECONDS": "0",
    "TEMPLATE_REFRESH_SECONDS": "0",
    "SMTP_SECURITY": "starttls",
    "GEOCODER_BASE_URL": "https://photon.komoot.io",
    "GEOCODER_USER_AGENT": "HRMS-Tests/1.0",
}
for _key, _value in _TEST_ENV.items():
    os.environ.setdefault(_key, _value)

# Settings is lru_cached; clear so test env overrides apply.
from app.core.config import get_settings  # noqa: E402

get_settings.cache_clear()

_TESTS_ROOT = Path(__file__).resolve().parent


@pytest.hookimpl(tryfirst=True)
def pytest_runtest_setup(item: pytest.Item) -> None:
    """Start the throwaway Docker database when the first DB test needs it."""
    if not test_db.CONTAINER_PENDING:
        return
    if not any(
        m.kwargs.get("reason") == test_db.DB_SKIP_REASON
        for m in item.iter_markers("skipif")
    ):
        return
    state = db_container.start()
    if state is None:
        if test_db.REQUIRED:  # CI must not turn a missing database into a green run
            pytest.fail("REQUIRE_DB_TESTS=1 but the throwaway Docker database could not start.")
        pytest.skip(test_db.DB_SKIP_REASON)
    if state == "started":  # first DB test of the run: build the tables once
        db_container.apply_schema()


def pytest_sessionfinish(session: pytest.Session, exitstatus: int) -> None:
    db_container.stop()


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    """Auto-mark tests from tests/{unit,functional}/."""
    for item in items:
        try:
            rel = Path(item.path).resolve().relative_to(_TESTS_ROOT)
        except ValueError:
            continue
        kind = rel.parts[0] if rel.parts else ""
        if kind in {"unit", "functional"}:
            item.add_marker(getattr(pytest.mark, kind))


@pytest.fixture(autouse=True)
def mock_aiosmtplib_send(monkeypatch: pytest.MonkeyPatch) -> AsyncMock:
    """Never hit a real SMTP server from tests."""
    mock = AsyncMock(return_value={"message_id": "test-message-id"})
    monkeypatch.setattr("aiosmtplib.send", mock)
    monkeypatch.setattr("app.mail.smtp.aiosmtplib.send", mock)
    return mock
