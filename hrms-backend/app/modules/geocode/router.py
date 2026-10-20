"""Authenticated address autocomplete (Photon proxy)."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.modules.geocode import service as svc

router = APIRouter(prefix="/geocode", tags=["Geocode"])


@router.get("/search")
async def search_geocode(
    q: str = Query(default=""),
    countrycodes: str | None = Query(default=None),
    limit: int | None = Query(default=None),
) -> dict[str, list[dict[str, str]]]:
    """Return address suggestions for office / employee address forms."""
    suggestions = await svc.search_addresses(
        q,
        country_code=countrycodes,
        limit=limit,
    )
    return {"suggestions": suggestions}
