"""MinIO (S3-compatible) object storage for employee documents.

When ``TESTING=1`` (or ``STORAGE_BACKEND=local``), uses an on-disk store so
ASGI smoke works without MinIO.
"""

from __future__ import annotations

import io
import logging
import os
import re
import tempfile
from functools import lru_cache
from pathlib import Path

from fastapi import HTTPException
from starlette.concurrency import run_in_threadpool
from minio import Minio
from minio.error import S3Error

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)

_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")


def safe_filename(name: str) -> str:
    cleaned = _SAFE_NAME.sub("_", (name or "file").strip()) or "file"
    return cleaned[:200]


class LocalObjectStorage:
    """Filesystem stand-in with the same surface as ObjectStorage."""

    def __init__(self, root: Path | None = None) -> None:
        self._root = root or Path(tempfile.gettempdir()) / "hrms-local-storage"
        self._ensured = False

    def ensure_bucket(self) -> None:
        if self._ensured:
            return
        self._root.mkdir(parents=True, exist_ok=True)
        self._ensured = True

    def _path(self, object_key: str) -> Path:
        # Keep object keys nested; refuse path escape.
        path = (self._root / object_key).resolve()
        if not str(path).startswith(str(self._root.resolve())):
            raise HTTPException(status_code=400, detail="Invalid object key")
        return path

    def put_bytes(self, object_key: str, data: bytes, content_type: str) -> None:
        self.ensure_bucket()
        path = self._path(object_key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        meta = path.with_suffix(path.suffix + ".content-type")
        meta.write_text(content_type or "application/octet-stream", encoding="utf-8")

    def get_bytes(self, object_key: str) -> tuple[bytes, str]:
        self.ensure_bucket()
        path = self._path(object_key)
        if not path.is_file():
            raise HTTPException(status_code=404, detail="File not found in object storage")
        data = path.read_bytes()
        meta = path.with_suffix(path.suffix + ".content-type")
        content_type = (
            meta.read_text(encoding="utf-8").strip()
            if meta.is_file()
            else "application/octet-stream"
        )
        return data, content_type

    def remove(self, object_key: str) -> None:
        if not object_key:
            return
        self.ensure_bucket()
        path = self._path(object_key)
        meta = path.with_suffix(path.suffix + ".content-type")
        if path.is_file():
            path.unlink()
        if meta.is_file():
            meta.unlink()

    def presigned_get(self, object_key: str, *, expires_seconds: int = 300) -> str:
        _ = expires_seconds
        # Local mode has no signed URLs; callers should use get_bytes routes.
        return f"local://{object_key}"


class ObjectStorage:
    def __init__(self, settings: Settings) -> None:
        self._bucket = settings.minio_bucket
        self._client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )
        self._ensured = False

    def ensure_bucket(self) -> None:
        if self._ensured:
            return
        try:
            if not self._client.bucket_exists(self._bucket):
                self._client.make_bucket(self._bucket)
            self._ensured = True
        except S3Error as exc:
            logger.exception("MinIO bucket check failed")
            raise HTTPException(status_code=503, detail=f"Object storage unavailable: {exc}") from exc
        except Exception as exc:
            logger.exception("MinIO connection failed")
            raise HTTPException(status_code=503, detail=f"Object storage unavailable: {exc}") from exc

    def put_bytes(self, object_key: str, data: bytes, content_type: str) -> None:
        self.ensure_bucket()
        try:
            self._client.put_object(
                self._bucket,
                object_key,
                io.BytesIO(data),
                len(data),
                content_type=content_type or "application/octet-stream",
            )
        except S3Error as exc:
            logger.exception("MinIO put_object failed")
            raise HTTPException(status_code=502, detail=f"Upload to object storage failed: {exc}") from exc

    def get_bytes(self, object_key: str) -> tuple[bytes, str]:
        self.ensure_bucket()
        try:
            response = self._client.get_object(self._bucket, object_key)
            try:
                data = response.read()
                headers = getattr(response, "headers", None) or {}
                content_type = headers.get("Content-Type", "application/octet-stream")
                return data, content_type
            finally:
                response.close()
                response.release_conn()
        except S3Error as exc:
            if getattr(exc, "code", None) in {"NoSuchKey", "NoSuchObject"}:
                raise HTTPException(status_code=404, detail="File not found in object storage") from exc
            logger.exception("MinIO get_object failed")
            raise HTTPException(status_code=502, detail=f"Download from object storage failed: {exc}") from exc

    def remove(self, object_key: str) -> None:
        if not object_key:
            return
        self.ensure_bucket()
        try:
            self._client.remove_object(self._bucket, object_key)
        except S3Error as exc:
            # Deleting missing objects is fine — DB row is source of truth for soft-delete.
            if getattr(exc, "code", None) in {"NoSuchKey", "NoSuchObject"}:
                return
            logger.exception("MinIO remove_object failed")
            raise HTTPException(status_code=502, detail=f"Delete from object storage failed: {exc}") from exc

    def presigned_get(self, object_key: str, *, expires_seconds: int = 300) -> str:
        """Short-lived signed download URL (default 5 minutes)."""
        from datetime import timedelta

        self.ensure_bucket()
        try:
            return self._client.presigned_get_object(
                self._bucket,
                object_key,
                expires=timedelta(seconds=max(30, min(expires_seconds, 3600))),
            )
        except S3Error as exc:
            logger.exception("MinIO presigned_get_object failed")
            raise HTTPException(
                status_code=502, detail=f"Could not create download URL: {exc}"
            ) from exc


@lru_cache
def get_storage() -> ObjectStorage | LocalObjectStorage:
    settings = get_settings()
    backend = (os.environ.get("STORAGE_BACKEND") or "").strip().lower()
    testing = (os.environ.get("TESTING") or "").strip() in {"1", "true", "True"}
    if backend == "local" or testing:
        logger.info("Using local filesystem object storage (TESTING/STORAGE_BACKEND)")
        return LocalObjectStorage()
    return ObjectStorage(settings)


async def read_object(storage: ObjectStorage, object_key: str) -> tuple[bytes, str]:
    """Download an object without blocking the event loop.

    The MinIO client is synchronous. Calling it directly from an ``async`` route
    stops every other request on the worker until the download returns, so
    concurrent downloads (a page of logos) queue one behind the other.
    """
    return await run_in_threadpool(storage.get_bytes, object_key)
