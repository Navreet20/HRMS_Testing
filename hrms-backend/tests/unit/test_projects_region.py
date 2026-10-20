"""Project write-body region validation."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.modules.projects.schemas import PROJECT_REGIONS, ProjectWriteBody


@pytest.mark.parametrize("region", PROJECT_REGIONS)
def test_project_region_accepts_catalog_values(region: str) -> None:
    body = ProjectWriteBody.model_validate({"region": region})
    assert body.region == region


def test_project_region_empty_is_none() -> None:
    assert ProjectWriteBody.model_validate({"region": ""}).region is None
    assert ProjectWriteBody.model_validate({"region": None}).region is None
    assert ProjectWriteBody.model_validate({}).region is None


def test_project_region_rejects_unknown() -> None:
    with pytest.raises(ValidationError) as exc:
        ProjectWriteBody.model_validate({"region": "Antarctica"})
    assert "NA, EMEA, APAC, or LATAM" in str(exc.value)
