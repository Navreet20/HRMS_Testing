"""Photon geocode upstream client."""

from __future__ import annotations

import logging
from typing import Any
from urllib.parse import urlencode

import httpx

from app.core.config import get_settings
from app.modules.geocode.photon import parse_photon_results

logger = logging.getLogger(__name__)

GEOCODE_MIN_QUERY_LENGTH = 3
GEOCODE_UPSTREAM_LIMIT = 8
GEOCODER_ACCEPT_LANGUAGE = "en"
DEFAULT_PHOTON_BASE = "https://photon.komoot.io"
DEFAULT_GEOCODER_USER_AGENT = (
    "HRMS-LocationPicker/1.0 (office-location-form; Photon)"
)


def _geocoder_base() -> str:
    settings = get_settings()
    configured = (settings.geocoder_base_url or "").strip()
    return (configured or DEFAULT_PHOTON_BASE).rstrip("/")


def _user_agent() -> str:
    settings = get_settings()
    configured = (settings.geocoder_user_agent or "").strip()
    return configured or DEFAULT_GEOCODER_USER_AGENT


def build_upstream_url(
    query: str,
    *,
    country_code: str | None = None,
    limit: int = GEOCODE_UPSTREAM_LIMIT,
) -> str:
    biased = f"{query} {country_code}" if country_code else query
    params = urlencode(
        {
            "q": biased,
            "limit": str(limit),
            "lang": GEOCODER_ACCEPT_LANGUAGE,
        }
    )
    return f"{_geocoder_base()}/api?{params}"


async def search_addresses(
    query: str,
    *,
    country_code: str | None = None,
    limit: int | None = None,
) -> list[dict[str, str]]:
    text = query.strip()
    if len(text) < GEOCODE_MIN_QUERY_LENGTH:
        return []

    capped = GEOCODE_UPSTREAM_LIMIT
    if limit is not None:
        capped = max(1, min(int(limit), GEOCODE_UPSTREAM_LIMIT))

    code = (country_code or "").strip().upper() or None
    url = build_upstream_url(text, country_code=code, limit=capped)
    headers = {
        "Accept": "application/json",
        "Accept-Language": GEOCODER_ACCEPT_LANGUAGE,
        "User-Agent": _user_agent(),
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(url, headers=headers)
        if response.status_code >= 400:
            logger.warning("geocode upstream status=%s", response.status_code)
            return []
        payload: Any = response.json()
        return parse_photon_results(payload)
    except Exception:
        logger.exception("geocode upstream failed")
        return []
