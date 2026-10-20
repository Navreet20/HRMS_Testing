"""HTTP responses for stored images that the browser can keep."""

from __future__ import annotations

import hashlib
import time

from fastapi import Response

from app.core.storage import ObjectStorage, read_object

# A URL that names its own version never changes content, so the browser can
# keep it for a year without asking again. Object keys carry a fresh id on every
# upload, so a new logo is a new version and a new URL.
_VERSIONED = "private, max-age=31536000, immutable"
_UNVERSIONED = "private, max-age=60"


def object_etag(object_key: str) -> str:
    return '"' + hashlib.sha256(object_key.encode()).hexdigest()[:24] + '"'


def _matches(if_none_match: str | None, etag: str) -> bool:
    if not if_none_match:
        return False
    return any(part.strip() in (etag, "*") for part in if_none_match.split(","))


async def cached_object_response(
    storage: ObjectStorage,
    object_key: str,
    *,
    version: str | None,
    if_none_match: str | None,
    extra_headers: dict[str, str] | None = None,
) -> Response:
    """The object's bytes with cache headers; 304 when the browser's copy is current.

    ``version`` is the object key the page was built with. When it matches the
    current key the response is cacheable for a year; otherwise (an old link, or
    none) it falls back to a short cache and the ETag.
    """
    etag = object_etag(object_key)
    headers = {
        "ETag": etag,
        "Cache-Control": _VERSIONED if version == object_key else _UNVERSIONED,
        **(extra_headers or {}),
    }
    if _matches(if_none_match, etag):
        return Response(status_code=304, headers=headers)
    started = time.perf_counter()
    data, content_type = await read_object(storage, object_key)
    headers["Server-Timing"] = f"storage;dur={(time.perf_counter() - started) * 1000:.0f}"
    return Response(
        content=data,
        media_type=content_type or "application/octet-stream",
        headers=headers,
    )
