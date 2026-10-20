from typing import Annotated, Any, Callable

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.bootstrap_admin import (
    apply_session_view,
    is_allowlist_superadmin_claims,
    is_superadmin_email,
    is_unlisted_system_account,
)
from app.core.config import get_settings
from app.core.cookies import ACCESS_COOKIE, CSRF_COOKIE, CSRF_HEADER
from app.core.roles import Role, session_access_roles
from app.core.security import decode_access_token
from app.db.session import get_db

bearer_scheme = HTTPBearer(auto_error=False)

# Documents the CSRF header for Swagger's Authorize dialog; SecurityMiddleware
# does the actual check (header must equal the eaova_csrf cookie).
csrf_header_scheme = APIKeyHeader(
    name=CSRF_HEADER,
    scheme_name="CSRF",
    description=(
        f"Required on POST/PUT/PATCH/DELETE. Paste the value of the `{CSRF_COOKIE}` "
        "cookie (or `csrfToken` from GET /api/v1/auth/csrf)."
    ),
    auto_error=False,
)

def extract_access_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None,
) -> str | None:
    if credentials is not None and credentials.credentials:
        return credentials.credentials
    cookie = request.cookies.get(ACCESS_COOKIE)
    if isinstance(cookie, str) and cookie.strip():
        return cookie.strip()
    return None


async def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    session: Annotated[AsyncSession, Depends(get_db, scope="function")],
) -> dict[str, Any]:
    """Stateless: verify the signed JWT (cookie or Bearer). No session row is read."""
    if get_settings().auth_bypass:
        # Local only: allowlist Superadmin claims, no employee row (see AuthService.bypass_claims).
        from app.modules.auth.service import AuthService

        return await AuthService().bypass_claims(session)

    token = extract_access_token(request, credentials)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )
    try:
        claims = decode_access_token(token)
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        ) from exc

    allowlist_sa = is_allowlist_superadmin_claims(claims)
    if not claims.get("employeeId") and not allowlist_sa:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session required — please sign in again",
        )
    if allowlist_sa and not is_superadmin_email(
        get_settings(), str(claims.get("emailId") or "")
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or revoked",
        )

    # A Superadmin removed from the allowlist loses access at once.
    if is_unlisted_system_account(claims):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or revoked",
        )

    # Superadmin view is re-checked against SUPERADMIN_EMAILS per request.
    return apply_session_view(claims, claims.get("activeView"))

CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]


def require_roles(
    *roles: Role, detail: str = "Insufficient permissions"
) -> Callable[..., Any]:
    allowed = {r.value for r in roles}

    async def _checker(user: CurrentUser) -> dict[str, Any]:
        if get_settings().auth_bypass:
            return user
        user_roles = session_access_roles(user)
        if not user_roles.intersection(allowed):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=detail
            )
        return user

    return _checker
