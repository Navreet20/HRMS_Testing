"""Security middleware: CSRF double-submit + baseline XSS response headers."""

from __future__ import annotations

from collections.abc import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import get_settings
from app.core.cookies import CSRF_COOKIE, CSRF_HEADER

_SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS", "TRACE"})
_CSRF_EXEMPT_PATHS = frozenset(
    {
        "/api/v1/auth/csrf",
        "/api/v1/auth/entra/login",
        "/api/v1/auth/entra/callback",
        "/api/v1/auth/forgot-password",
        "/health",
        "/api/v1/health",
    }
)

_DOCS_PATHS = frozenset(
    {"/docs", "/docs/", "/redoc", "/redoc/", "/openapi.json", "/docs/oauth2-redirect"}
)
_API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
_UI_CSP = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data:; "
    "font-src 'self' data:; "
    "connect-src 'self'; "
    "frame-ancestors 'none'; "
    "base-uri 'self'; "
    "form-action 'self'"
)
# FastAPI Swagger/ReDoc load JS/CSS from jsDelivr and a favicon from fastapi.tiangolo.com.
_DOCS_CSP = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "img-src 'self' data: https://fastapi.tiangolo.com https://cdn.jsdelivr.net; "
    "font-src 'self' data: https://cdn.jsdelivr.net; "
    "connect-src 'self'; "
    "frame-ancestors 'none'; "
    "base-uri 'self'; "
    "form-action 'self'"
)


def _csp_for_path(path: str) -> str:
    if path.startswith("/api/"):
        return _API_CSP
    if path in _DOCS_PATHS or path.startswith("/docs"):
        return _DOCS_CSP
    return _UI_CSP


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        bypass = get_settings().auth_bypass
        if (
            not bypass
            and request.method not in _SAFE_METHODS
            and path not in _CSRF_EXEMPT_PATHS
            and path.startswith("/api/")
        ):
            cookie_token = request.cookies.get(CSRF_COOKIE)
            header_token = request.headers.get(CSRF_HEADER)
            if (
                not cookie_token
                or not header_token
                or cookie_token != header_token
            ):
                return JSONResponse(
                    status_code=403,
                    content={"detail": "CSRF validation failed"},
                )

        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Content-Security-Policy",
            _csp_for_path(path),
        )
        response.headers.setdefault(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=()",
        )
        return response
