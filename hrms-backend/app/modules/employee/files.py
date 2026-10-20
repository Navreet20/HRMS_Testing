"""Upload validation for employee documents and avatars."""

from __future__ import annotations

from fastapi import HTTPException, UploadFile

AVATAR_MAX_BYTES = 2 * 1024 * 1024
DOCUMENT_MAX_BYTES = 10 * 1024 * 1024

AVATAR_CONTENT_TYPES = frozenset(
    {
        "image/jpeg",
        "image/png",
        "image/webp",
    }
)

DOCUMENT_CONTENT_TYPES = frozenset(
    {
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "text/plain",
    }
)

_AVATAR_EXT = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


def avatar_extension(content_type: str) -> str:
    return _AVATAR_EXT.get(content_type, "bin")


async def read_validated_upload(
    upload: UploadFile | None,
    *,
    allowed_types: frozenset[str],
    max_bytes: int,
    kind: str,
) -> tuple[bytes, str]:
    if upload is None:
        raise HTTPException(status_code=400, detail=f"{kind} file is required")
    data = await upload.read()
    if not data:
        raise HTTPException(status_code=400, detail=f"{kind} file is empty")
    if len(data) > max_bytes:
        mb = max_bytes // (1024 * 1024)
        raise HTTPException(
            status_code=400,
            detail=f"{kind} exceeds {mb} MB limit",
        )
    content_type = (upload.content_type or "").split(";")[0].strip().lower()
    if content_type not in allowed_types:
        allowed = ", ".join(sorted(allowed_types))
        raise HTTPException(
            status_code=400,
            detail=f"Disallowed {kind.lower()} type '{content_type or 'unknown'}'. Allowed: {allowed}",
        )
    return data, content_type


async def read_validated_avatar(upload: UploadFile | None) -> tuple[bytes, str]:
    return await read_validated_upload(
        upload,
        allowed_types=AVATAR_CONTENT_TYPES,
        max_bytes=AVATAR_MAX_BYTES,
        kind="Avatar",
    )


async def read_validated_document(upload: UploadFile | None) -> tuple[bytes, str]:
    return await read_validated_upload(
        upload,
        allowed_types=DOCUMENT_CONTENT_TYPES,
        max_bytes=DOCUMENT_MAX_BYTES,
        kind="Document",
    )
