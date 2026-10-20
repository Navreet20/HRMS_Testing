"""Auth cookie helpers (httpOnly access token + readable CSRF cookie)."""

from __future__ import annotations

from secrets import token_urlsafe
from typing import Any

from fastapi import Response

from app.core.config import get_settings
from app.core.security import access_token_ttl

ACCESS_COOKIE = "eaova_access"
CSRF_COOKIE = "eaova_csrf"
CSRF_HEADER = "X-CSRF-Token"


def _cookie_common() -> dict[str, Any]:
    settings = get_settings()
    payload: dict[str, Any] = {
        "path": "/",
        "secure": settings.cookie_secure,
        "samesite": settings.cookie_samesite,
    }
    if settings.cookie_domain:
        payload["domain"] = settings.cookie_domain
    return payload


def new_csrf_token() -> str:
    return token_urlsafe(32)


def set_auth_cookies(
    response: Response,
    *,
    access_token: str,
    csrf_token: str | None = None,
    max_age: int | None = None,
) -> str:
    """Set httpOnly access cookie + readable CSRF cookie. Returns CSRF value."""
    csrf = csrf_token or new_csrf_token()
    age = max_age
    if age is None:
        age = int(access_token_ttl().total_seconds())
    common = _cookie_common()
    response.set_cookie(
        ACCESS_COOKIE,
        access_token,
        httponly=True,
        max_age=age,
        **common,
    )
    response.set_cookie(
        CSRF_COOKIE,
        csrf,
        httponly=False,
        max_age=age,
        **common,
    )
    return csrf


def clear_auth_cookies(response: Response) -> None:
    settings = get_settings()
    for name in (ACCESS_COOKIE, CSRF_COOKIE):
        response.delete_cookie(
            name,
            path="/",
            domain=settings.cookie_domain or None,
            secure=settings.cookie_secure,
            samesite=settings.cookie_samesite,
        )
