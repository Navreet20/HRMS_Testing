"""Designation job family (DEPT-DATA-5) validation."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.modules.org.service import _parse_job_family


def test_parse_job_family_requires_value() -> None:
    with pytest.raises(HTTPException) as exc:
        _parse_job_family("", required=True)
    assert exc.value.status_code == 400
    assert "jobFamily is required" in str(exc.value.detail)


def test_parse_job_family_rejects_unknown() -> None:
    with pytest.raises(HTTPException) as exc:
        _parse_job_family("Sales", required=True)
    assert exc.value.status_code == 400


def test_parse_job_family_accepts_allowed() -> None:
    assert _parse_job_family("Engineering", required=True) == "Engineering"
    assert _parse_job_family("Corporate", required=True) == "Corporate"
