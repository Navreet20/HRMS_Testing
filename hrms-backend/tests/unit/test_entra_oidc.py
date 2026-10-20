"""Unit tests for Entra OIDC helpers (no live Microsoft calls)."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.modules.auth import entra as entra_oidc


def test_pkce_pair_shape() -> None:
    verifier, challenge = entra_oidc.new_pkce_pair()
    assert len(verifier) >= 43
    assert len(challenge) >= 43
    assert "=" not in challenge


def test_sign_in_link_always_shows_the_account_picker() -> None:
    from urllib.parse import parse_qs, urlparse

    from app.core.config import get_settings

    url = entra_oidc.build_authorize_redirect_url(
        state="s", code_challenge="c", settings=get_settings()
    )
    assert parse_qs(urlparse(url).query)["prompt"] == ["select_account"]


def test_pack_unpack_oidc_cookie() -> None:
    packed = entra_oidc.pack_oidc_cookie("state-one", "verifier-two")
    assert entra_oidc.unpack_oidc_cookie(packed) == ("state-one", "verifier-two")
    assert entra_oidc.unpack_oidc_cookie(None) is None
    assert entra_oidc.unpack_oidc_cookie("nostate") is None


def test_email_from_id_token_claims_prefers_email() -> None:
    assert (
        entra_oidc.email_from_id_token_claims(
            {
                "email": "User@Example.COM",
                "preferred_username": "other@example.com",
            }
        )
        == "user@example.com"
    )


def test_email_from_id_token_claims_falls_back_to_upn() -> None:
    assert (
        entra_oidc.email_from_id_token_claims({"upn": "pat@contoso.com"})
        == "pat@contoso.com"
    )


def test_email_from_id_token_claims_requires_emailish() -> None:
    with pytest.raises(HTTPException) as exc:
        entra_oidc.email_from_id_token_claims({"oid": "abc"})
    assert exc.value.status_code == 401


def test_build_authorize_redirect_url_includes_pkce() -> None:
    url = entra_oidc.build_authorize_redirect_url(
        state="abc",
        code_challenge="challenge",
    )
    assert "login.microsoftonline.com" in url
    assert "code_challenge=challenge" in url
    assert "code_challenge_method=S256" in url
    assert "state=abc" in url
