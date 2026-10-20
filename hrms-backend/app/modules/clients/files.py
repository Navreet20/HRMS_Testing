"""Upload validation for client logos."""

from __future__ import annotations

from fastapi import HTTPException, UploadFile

LOGO_MAX_BYTES = 5 * 1024 * 1024

LOGO_CONTENT_TYPES = frozenset(
    {
        "image/jpeg",
        "image/png",
        "image/svg+xml",
    }
)

_LOGO_EXT = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/svg+xml": "svg",
}


def logo_extension(content_type: str) -> str:
    return _LOGO_EXT.get(content_type, "bin")


async def read_validated_logo(upload: UploadFile | None) -> tuple[bytes, str]:
    if upload is None:
        raise HTTPException(status_code=400, detail="Logo file is required")
    data = await upload.read()
    if not data:
        raise HTTPException(status_code=400, detail="Logo file is empty")
    if len(data) > LOGO_MAX_BYTES:
        raise HTTPException(status_code=400, detail="Logo exceeds 5 MB limit")
    content_type = (upload.content_type or "").split(";")[0].strip().lower()
    if content_type not in LOGO_CONTENT_TYPES:
        allowed = ", ".join(sorted(LOGO_CONTENT_TYPES))
        raise HTTPException(
            status_code=400,
            detail=f"Disallowed logo type '{content_type or 'unknown'}'. Allowed: {allowed}",
        )
    return data, content_type
