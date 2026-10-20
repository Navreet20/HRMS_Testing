"""Unit tests for consolidated employee list query validation."""

import pytest
from fastapi import HTTPException

from app.modules.employee.list_query import ALLOWED_LIST_STATUSES, resolve_list_query


def test_default_query_is_empty() -> None:
    q = resolve_list_query()
    assert q.email is None
    assert q.status is None
    assert q.q is None


def test_email_exclusive() -> None:
    q = resolve_list_query(email="  a@b.com ")
    assert q.email == "a@b.com"


def test_email_empty_rejected() -> None:
    with pytest.raises(HTTPException) as exc:
        resolve_list_query(email="  ")
    assert exc.value.status_code == 400


def test_email_combined_with_status_rejected() -> None:
    with pytest.raises(HTTPException) as exc:
        resolve_list_query(email="a@b.com", status="ACTIVE")
    assert exc.value.status_code == 400


def test_empty_q_rejected() -> None:
    with pytest.raises(HTTPException) as exc:
        resolve_list_query(q="")
    assert exc.value.status_code == 400


def test_unknown_status_rejected() -> None:
    with pytest.raises(HTTPException) as exc:
        resolve_list_query(status="NOT_A_STATUS")
    assert exc.value.status_code == 400
    assert "Unknown status" in str(exc.value.detail)


def test_allowed_statuses_cover_lifecycle() -> None:
    for status in ("ACTIVE", "INACTIVE", "NEW", "PENDING"):
        assert status in ALLOWED_LIST_STATUSES
        assert resolve_list_query(status=status).status == status


def test_legacy_status_aliases_map_to_inactive() -> None:
    for status in ("SUSPENDED", "EXITED", "REJECTED", "TERMINATED", "RESIGNED", "ERROR"):
        assert resolve_list_query(status=status).status == "INACTIVE"


def test_draft_alias_maps_to_new() -> None:
    assert resolve_list_query(status="DRAFT").status == "NEW"


def test_sort_and_page() -> None:
    q = resolve_list_query(sort="name", sort_dir="desc", page=2, page_size=25)
    assert q.sort == "name"
    assert q.sort_dir == "desc"
    assert q.page == 2
    assert q.page_size == 25


def test_last_updated_sort_allowed() -> None:
    q = resolve_list_query(sort="lastUpdated", sort_dir="desc", status="NEW")
    assert q.sort == "lastupdated"
    assert q.sort_dir == "desc"
    assert q.status == "NEW"


def test_unknown_sort_rejected() -> None:
    with pytest.raises(HTTPException) as exc:
        resolve_list_query(sort="startDate")
    assert exc.value.status_code == 400


def test_primary_true_maps_to_active() -> None:
    assert resolve_list_query(primary=True).status == "ACTIVE"


def test_reports_to_and_job_rank() -> None:
    q = resolve_list_query(reports_to="boss-1", job_rank="SENIOR")
    assert q.reports_to == "boss-1"
    assert q.job_rank == "SENIOR"


def test_org_fk_filters() -> None:
    q = resolve_list_query(
        department_id="d1",
        location_id="l1",
        designation_id="t1",
    )
    assert q.department_id == "d1"
    assert q.location_id == "l1"
    assert q.designation_id == "t1"


def test_empty_client_id_rejected() -> None:
    with pytest.raises(HTTPException) as exc:
        resolve_list_query(client_id="  ")
    assert exc.value.status_code == 400
