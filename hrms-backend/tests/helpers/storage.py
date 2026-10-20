"""Keep tests away from real object storage.

``MINIO_*`` is always overwritten in the test process (like ``DB_*``), so real
values from the shell or ``.env`` can never make a test write to shared storage.
"""

from __future__ import annotations

import os
from collections.abc import MutableMapping

TEST_MINIO_ENV: dict[str, str] = {
    "MINIO_ENDPOINT": "localhost:9000",
    "MINIO_ACCESS_KEY": "test-minio-access",
    "MINIO_SECRET_KEY": "test-minio-secret",
    "MINIO_BUCKET": "hrms-documents",
    "MINIO_SECURE": "false",
}


def force_test_storage(environ: MutableMapping[str, str] | None = None) -> None:
    (os.environ if environ is None else environ).update(TEST_MINIO_ENV)
