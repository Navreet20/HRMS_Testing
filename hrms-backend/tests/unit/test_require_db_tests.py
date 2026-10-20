"""REQUIRE_DB_TESTS=1 turns a silent skip of the database tests into a failure."""

import pytest

from tests.helpers.db import DbTestsRequiredError, check_required


def test_does_nothing_when_not_required() -> None:
    check_required({}, enabled=False)
    check_required({"SKIP_DB_TESTS": "1"}, enabled=False)


def test_passes_when_required_and_a_database_is_available() -> None:
    check_required({"REQUIRE_DB_TESTS": "1"}, enabled=True)


def test_fails_when_required_but_no_database_is_available() -> None:
    with pytest.raises(DbTestsRequiredError, match="TEST_DATABASE_URL is not set"):
        check_required({"REQUIRE_DB_TESTS": "1"}, enabled=False)


def test_fails_when_required_but_skipping_was_requested() -> None:
    with pytest.raises(DbTestsRequiredError, match="SKIP_DB_TESTS is set"):
        check_required({"REQUIRE_DB_TESTS": "1", "SKIP_DB_TESTS": "1"}, enabled=True)
