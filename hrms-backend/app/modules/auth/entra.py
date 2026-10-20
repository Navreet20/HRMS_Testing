"""Microsoft Entra ID OIDC helpers (authorization code + PKCE)."""

from __future__ import annotations

import base64
import hashlib
import secrets
from typing import Any
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import HTTPException, status
from jwt import PyJWKClient

from app.core.config import Settings, get_settings

# Provider name stored with linked sign-in identities (AUTH_IDENTITY.PROVIDER).
IDENTITY_PROVIDER = "entra"
OIDC_COOKIE = "eaova_oidc"
OIDC_COOKIE_MAX_AGE = 600


def require_entra_settings(settings: Settings | None = None) -> Settings:
    cfg = settings or get_settings()
    if cfg.auth_bypass:
        return cfg
    if not cfg.entra_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Microsoft Entra is not configured",
        )
    return cfg


def new_pkce_pair() -> tuple[str, str]:
    """Return (code_verifier, code_challenge) for S256 PKCE."""
    verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return verifier, challenge


def new_oidc_state() -> str:
    return secrets.token_urlsafe(32)


def pack_oidc_cookie(state: str, code_verifier: str) -> str:
    return f"{state}.{code_verifier}"


def unpack_oidc_cookie(raw: str | None) -> tuple[str, str] | None:
    if not raw or "." not in raw:
        return None
    state, _, verifier = raw.partition(".")
    if not state or not verifier:
        return None
    return state, verifier


def build_authorize_redirect_url(
    *,
    state: str,
    code_challenge: str,
    settings: Settings | None = None,
) -> str:
    cfg = require_entra_settings(settings)
    params = {
        "client_id": cfg.entra_client_id,
        "response_type": "code",
        "redirect_uri": cfg.entra_redirect_uri,
        "response_mode": "query",
        "scope": cfg.entra_scopes,
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        # Always show Microsoft's account picker, so someone with more than one
        # Microsoft account (e.g. arohak.com and cognivance.com) can choose.
        "prompt": "select_account",
    }
    return f"{cfg.entra_authorize_url}?{urlencode(params)}"


async def exchange_code_for_tokens(
    *,
    code: str,
    code_verifier: str,
    settings: Settings | None = None,
) -> dict[str, Any]:
    cfg = require_entra_settings(settings)
    data = {
        "client_id": cfg.entra_client_id,
        "client_secret": cfg.entra_client_secret.get_secret_value(),
        "code": code,
        "redirect_uri": cfg.entra_redirect_uri,
        "grant_type": "authorization_code",
        "code_verifier": code_verifier,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(cfg.entra_token_url, data=data)
    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Microsoft sign-in token exchange failed",
        )
    payload = response.json()
    if not isinstance(payload, dict) or not payload.get("id_token"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Microsoft sign-in did not return an id_token",
        )
    return payload


def validate_id_token(
    id_token: str,
    *,
    settings: Settings | None = None,
) -> dict[str, Any]:
    cfg = require_entra_settings(settings)
    jwks_client = PyJWKClient(cfg.entra_jwks_url, cache_keys=True)
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(id_token)
        claims = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=cfg.entra_client_id,
            issuer=cfg.entra_issuer,
            options={"require": ["exp", "iat", "aud", "iss"]},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Microsoft id_token",
        ) from exc
    if not isinstance(claims, dict):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Microsoft id_token",
        )
    return claims


def email_from_id_token_claims(claims: dict[str, Any]) -> str:
    for key in ("email", "preferred_username", "upn"):
        raw = claims.get(key)
        if isinstance(raw, str) and raw.strip() and "@" in raw:
            return raw.strip().lower()
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Microsoft account has no email claim",
    )
