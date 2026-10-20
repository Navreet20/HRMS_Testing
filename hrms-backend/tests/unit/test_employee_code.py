"""Unit tests for EMP-1.1 employee_code helpers."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.modules.employee.employee_code import (
    allocate_name_based_employee_code,
    format_employee_code,
    join_year_from,
    name_based_code_stem,
    next_sequence_from_codes,
    normalize_dept_token,
)


def _codes_session(codes: list[str | None]) -> AsyncMock:
    session = AsyncMock()
    session.add = MagicMock()
    result = MagicMock()
    result.scalars.return_value.all.return_value = codes
    session.execute = AsyncMock(return_value=result)
    return session


def test_normalize_from_department_name_single_word() -> None:
    assert (
        normalize_dept_token(
            department_name="Delivery",
            department_legacy="EMPLOYEE",
        )
        == "DELIVE"
    )


def test_normalize_from_department_name_initials() -> None:
    assert normalize_dept_token(department_name="Human Resources") == "HR"


def test_normalize_from_legacy_department() -> None:
    assert normalize_dept_token(department_legacy="EMPLOYEE") == "EMPLOY"
    assert normalize_dept_token(department_legacy="HR") == "HR"


def test_normalize_fallback_gen() -> None:
    assert normalize_dept_token() == "GEN"


def test_join_year_from_iso_date() -> None:
    assert join_year_from("2026-03-15") == "2026"
    assert join_year_from("2024-01-01T00:00:00Z") == "2024"


def test_join_year_from_invalid_falls_back_to_current() -> None:
    year = join_year_from("not-a-date")
    assert len(year) == 4 and year.isdigit()


def test_format_employee_code() -> None:
    assert format_employee_code("DEL", "2026", 1) == "DEL-2026-0001"
    assert format_employee_code("fin", "2026", 42) == "FIN-2026-0042"


def test_next_sequence_from_codes() -> None:
    prefix = "DEL-2026-"
    assert next_sequence_from_codes([], prefix) == 1
    assert (
        next_sequence_from_codes(
            ["DEL-2026-0001", "DEL-2026-0003", "HR-2026-0009", None],
            prefix,
        )
        == 4
    )


def test_name_based_code_stem_first_three() -> None:
    assert name_based_code_stem("Jane", "Doe") == "JAN_DOE"
    assert name_based_code_stem("Satya", "Hegde") == "SAT_HEG"


@pytest.mark.asyncio
async def test_allocate_name_based_returns_stem_when_free() -> None:
    session = _codes_session([])
    code = await allocate_name_based_employee_code(
        session, first_name="Jane", last_name="Doe"
    )
    assert code == "JAN_DOE"
    session.add.assert_not_called()


@pytest.mark.asyncio
async def test_allocate_name_based_suffix_when_stem_exists() -> None:
    session = _codes_session(["JAN_DOE"])
    code = await allocate_name_based_employee_code(
        session, first_name="Jane", last_name="Doe"
    )
    assert code == "JAN_DOE-2"
    session.add.assert_not_called()
