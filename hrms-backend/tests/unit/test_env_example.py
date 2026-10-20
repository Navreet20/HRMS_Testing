"""Keeps .env.example and the settings in step with each other.

Settings has no defaults, so every setting must be listed in .env.example (the
template teammates copy) or a fresh .env will not start the app.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
from pydantic import AliasChoices

from app.core.config import MissingSettingsError, Settings, get_settings

_EXAMPLE = Path(__file__).resolve().parents[2] / ".env.example"


def _example_keys() -> set[str]:
    return set(re.findall(r"^([A-Z][A-Z0-9_]*)=", _EXAMPLE.read_text(), flags=re.MULTILINE))


def _setting_names() -> set[str]:
    names: set[str] = set()
    for field in Settings.model_fields.values():
        alias = field.validation_alias or field.alias
        if isinstance(alias, AliasChoices):
            # The first choice is the current name; later ones are older names.
            names.add(str(alias.choices[0]))
        elif alias:
            names.add(str(alias))
    return names


def test_every_setting_is_listed_in_env_example() -> None:
    missing = sorted(_setting_names() - _example_keys())
    assert not missing, f".env.example is missing: {', '.join(missing)}"


def test_missing_settings_are_reported_by_name(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DB_HOST", raising=False)
    monkeypatch.delenv("PORT", raising=False)
    monkeypatch.setattr("app.core.config._ENV_FILES", ())
    monkeypatch.setitem(Settings.model_config, "env_file", ())
    get_settings.cache_clear()
    try:
        with pytest.raises(MissingSettingsError) as caught:
            get_settings()
        message = str(caught.value)
        assert "DB_HOST" in message and "PORT" in message
        assert ".env.example" in message
    finally:
        get_settings.cache_clear()
