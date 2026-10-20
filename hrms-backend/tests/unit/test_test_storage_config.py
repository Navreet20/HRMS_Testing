"""Real MINIO_* values in the environment must be ignored by tests."""

from __future__ import annotations

import os

from app.core.config import get_settings
from tests.helpers.storage import TEST_MINIO_ENV, force_test_storage


def test_real_minio_values_are_overwritten() -> None:
    env = {
        "MINIO_ENDPOINT": "storage.shared.example.com",
        "MINIO_ACCESS_KEY": "real-key",
        "MINIO_SECRET_KEY": "real-secret",
        "MINIO_BUCKET": "real-bucket",
        "MINIO_SECURE": "true",
    }

    force_test_storage(env)

    assert env == TEST_MINIO_ENV


def test_settings_in_the_test_process_use_test_storage() -> None:
    settings = get_settings()

    assert settings.minio_endpoint == "localhost:9000"
    assert settings.minio_access_key == "test-minio-access"
    assert settings.minio_secret_key == "test-minio-secret"
    assert os.environ["MINIO_ENDPOINT"] == "localhost:9000"
