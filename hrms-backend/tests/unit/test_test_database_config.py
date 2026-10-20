"""The test process must never reach the shared dev database."""

from __future__ import annotations

import pytest

from tests.helpers.db import configure_test_database


def test_unset_url_overwrites_env_db_values_and_disables_db_tests() -> None:
    env = {"DB_HOST": "shared.example.com", "DB_NAME": "shared", "DB_PASS": "secret"}

    enabled = configure_test_database(env)

    assert enabled is False
    assert env["DB_HOST"] == "127.0.0.1"
    assert env["DB_PORT"] == "1"
    assert env["DB_NAME"] != "shared"
    assert "secret" not in env.values()


def test_url_is_split_into_db_settings() -> None:
    env = {"TEST_DATABASE_URL": "postgresql://tester:pw@localhost:5433/hrms_test"}

    assert configure_test_database(env) is True
    assert (env["DB_HOST"], env["DB_PORT"], env["DB_NAME"]) == ("localhost", "5433", "hrms_test")
    assert (env["DB_USER"], env["DB_PASS"], env["DB_SSL"]) == ("tester", "pw", "false")


def test_sslmode_require_turns_ssl_on() -> None:
    env = {"TEST_DATABASE_URL": "postgresql://u:p@db.example.com/hrms_test?sslmode=require"}

    configure_test_database(env)

    assert env["DB_SSL"] == "true"
    assert env["DB_PORT"] == "5432"


def test_database_name_without_test_is_refused() -> None:
    env = {"TEST_DATABASE_URL": "postgresql://u:p@localhost:5432/hrms"}

    with pytest.raises(RuntimeError, match="contains 'test'"):
        configure_test_database(env)
