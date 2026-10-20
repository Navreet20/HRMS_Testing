"""Query-param validation for GET /employees."""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException

from app.core.roles import Status
from app.modules.employee.status import (
    EMPLOYEE_STATUSES,
    canonicalize_employee_status,
)

ALLOWED_LIST_STATUSES = EMPLOYEE_STATUSES
ALLOWED_SORT_KEYS = frozenset({"name", "department", "status", "email", "lastupdated"})
ALLOWED_SORT_DIRS = frozenset({"asc", "desc"})
DEFAULT_PAGE_SIZE = 10
MAX_PAGE_SIZE = 100


@dataclass(frozen=True, slots=True)
class EmployeeListQuery:
    email: str | None = None
    status: str | None = None
    q: str | None = None
    client_id: str | None = None
    vendor_id: str | None = None
    vendor_name: str | None = None
    project_id: str | None = None
    reports_to: str | None = None
    job_rank: str | None = None
    department_id: str | None = None
    location_id: str | None = None
    designation_id: str | None = None
    sort: str | None = None
    sort_dir: str = "asc"
    page: int | None = None
    page_size: int | None = None


def resolve_list_query(
    *,
    email: str | None = None,
    status: str | None = None,
    q: str | None = None,
    client_id: str | None = None,
    vendor_id: str | None = None,
    vendor_name: str | None = None,
    project_id: str | None = None,
    reports_to: str | None = None,
    job_rank: str | None = None,
    department_id: str | None = None,
    location_id: str | None = None,
    designation_id: str | None = None,
    primary: bool | None = None,
    sort: str | None = None,
    sort_dir: str | None = None,
    page: int | None = None,
    page_size: int | None = None,
) -> EmployeeListQuery:
    """Normalize and validate list filters. Raises HTTPException(400) on bad input."""
    if email is not None:
        email = email.strip()
        if not email:
            raise HTTPException(status_code=400, detail="email must not be empty")
        extras = [
            status,
            q,
            client_id,
            vendor_id,
            vendor_name,
            project_id,
            reports_to,
            job_rank,
            department_id,
            location_id,
            designation_id,
            sort,
            page,
            page_size,
        ]
        if primary or any(v is not None for v in extras):
            raise HTTPException(
                status_code=400,
                detail="email cannot be combined with other list filters",
            )
        return EmployeeListQuery(email=email)

    if q is not None:
        q = q.strip()
        if not q:
            raise HTTPException(
                status_code=400,
                detail="q must not be empty when provided",
            )

    resolved_status = status
    if primary is True:
        if resolved_status is not None and resolved_status != Status.ACTIVE.value:
            raise HTTPException(
                status_code=400,
                detail="primary=true conflicts with status (use status=ACTIVE or primary alone)",
            )
        resolved_status = Status.ACTIVE.value
    elif primary is False:
        raise HTTPException(
            status_code=400,
            detail="primary=false is not supported; omit primary or use status filters",
        )

    if resolved_status is not None:
        mapped = canonicalize_employee_status(resolved_status)
        if mapped is None:
            allowed = ", ".join(sorted(ALLOWED_LIST_STATUSES))
            raise HTTPException(
                status_code=400,
                detail=f"Unknown status '{resolved_status}'. Allowed: {allowed}",
            )
        resolved_status = mapped

    resolved_sort = None
    if sort is not None:
        resolved_sort = sort.strip().lower()
        if resolved_sort not in ALLOWED_SORT_KEYS:
            allowed = ", ".join(sorted(ALLOWED_SORT_KEYS))
            raise HTTPException(
                status_code=400,
                detail=f"Unknown sort '{sort}'. Allowed: {allowed}",
            )

    resolved_sort_dir = (sort_dir or "asc").strip().lower()
    if resolved_sort_dir not in ALLOWED_SORT_DIRS:
        raise HTTPException(
            status_code=400,
            detail="sortDir must be asc or desc",
        )

    resolved_page: int | None = None
    if page is not None:
        if page < 1:
            raise HTTPException(status_code=400, detail="page must be >= 1")
        resolved_page = page

    resolved_page_size: int | None = None
    if page_size is not None:
        if page_size < 1 or page_size > MAX_PAGE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"pageSize must be between 1 and {MAX_PAGE_SIZE}",
            )
        resolved_page_size = page_size
    elif resolved_page is not None:
        resolved_page_size = DEFAULT_PAGE_SIZE

    for label, value in (
        ("customerId", client_id),
        ("vendorId", vendor_id),
        ("vendorName", vendor_name),
        ("projectId", project_id),
        ("reportsTo", reports_to),
        ("jobRank", job_rank),
        ("departmentId", department_id),
        ("locationId", location_id),
        ("designationId", designation_id),
    ):
        if value is not None and not str(value).strip():
            raise HTTPException(status_code=400, detail=f"{label} must not be empty")

    def _strip(value: str | None) -> str | None:
        return value.strip() if value is not None else None

    return EmployeeListQuery(
        status=resolved_status,
        q=q,
        client_id=_strip(client_id),
        vendor_id=_strip(vendor_id),
        vendor_name=_strip(vendor_name),
        project_id=_strip(project_id),
        reports_to=_strip(reports_to),
        job_rank=_strip(job_rank),
        department_id=_strip(department_id),
        location_id=_strip(location_id),
        designation_id=_strip(designation_id),
        sort=resolved_sort,
        sort_dir=resolved_sort_dir,
        page=resolved_page,
        page_size=resolved_page_size,
    )
