"""Upload validation for company logos stored in object storage."""

from __future__ import annotations

import re

from fastapi import HTTPException, UploadFile, status

from app.modules.company.constants import (
    LOGO_CONTENT_TYPES,
    LOGO_INVALID_MESSAGE,
    MAX_LOGO_BYTES,
    MAX_LOGO_LABEL,
)

_LOGO_EXT = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/svg+xml": "svg",
}

_SVG_UNSAFE = re.compile(
    rb"<(?:script|foreignobject|iframe|embed|object|handler)\b"
    rb"|on[a-z]+\s*="
    rb"|javascript:"
    rb"|<\!entity\b"
    rb"|<\?php\b",
    re.IGNORECASE,
)


def logo_extension(content_type: str) -> str:
    return _LOGO_EXT.get(content_type, "bin")


def sniff_logo_content_type(data: bytes, declared: str) -> str:
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(data) >= 12 and data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "image/webp"
    sample = data[:2048].lstrip(b"\xef\xbb\xbf \t\r\n").lower()
    if sample.startswith(b"<svg") or (
        sample.startswith(b"<?xml") and b"<svg" in data[:4096].lower()
    ):
        return "image/svg+xml"
    declared_type = (declared or "").split(";")[0].strip().lower()
    if declared_type in {"image/jpeg", "image/png", "image/webp"}:
        return declared_type
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=LOGO_INVALID_MESSAGE,
    )


def assert_safe_svg(data: bytes) -> None:
    if _SVG_UNSAFE.search(data):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SVG logo cannot contain scripts or embedded documents.",
        )
    try:
        data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=LOGO_INVALID_MESSAGE,
        ) from exc


async def read_validated_logo(upload: UploadFile | None) -> tuple[bytes, str]:
    if upload is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Logo file is required.",
        )
    data = await upload.read()
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Logo file is empty.",
        )
    if len(data) > MAX_LOGO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Logo must be {MAX_LOGO_LABEL} or smaller.",
        )
    declared = (upload.content_type or "").split(";")[0].strip().lower()
    content_type = sniff_logo_content_type(data, declared)
    if content_type not in LOGO_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=LOGO_INVALID_MESSAGE,
        )
    if content_type == "image/svg+xml":
        assert_safe_svg(data)
    return data, content_type
