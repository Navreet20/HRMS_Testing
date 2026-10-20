from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse

from app.core.config import get_settings
from app.core.cookies import (
    CSRF_COOKIE,
    clear_auth_cookies,
    new_csrf_token,
    set_auth_cookies,
)
from app.dependencies import CurrentUser, csrf_header_scheme
from app.modules.auth import entra as entra_oidc
from app.modules.auth.schemas import (
    QuickActionsPreferenceRequest,
    QuickActionsPreferenceResponse,
    SwitchViewBody,
    ThemePreferenceRequest,
    ThemePreferenceResponse,
)
from app.modules.auth.service import AuthService
from app.modules.deps import DbSession
from app.modules.employee.service import EmployeeService
from app.schemas.common import ForgotPasswordBody, PasswordResetBody

router = APIRouter(
    prefix="/api/v1/auth",
    tags=["Auth"],
    dependencies=[Depends(csrf_header_scheme)],
)
_auth = AuthService()
_employees = EmployeeService()


def _fe_redirect(error: str | None = None) -> RedirectResponse:
    settings = get_settings()
    base = settings.entra_post_login_redirect.rstrip("/") or "http://localhost:3000"
    if error:
        return RedirectResponse(
            url=f"{base}/?{urlencode({'authError': error})}",
            status_code=status.HTTP_302_FOUND,
        )
    return RedirectResponse(url=f"{base}/", status_code=status.HTTP_302_FOUND)


def _clear_oidc_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        entra_oidc.OIDC_COOKIE,
        path="/",
        domain=settings.cookie_domain or None,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
    )


@router.get("/csrf")
async def csrf_bootstrap(response: Response) -> dict[str, str]:
    """Issue a readable CSRF cookie before credentialed mutations."""
    settings = get_settings()
    csrf = new_csrf_token()
    response.set_cookie(
        CSRF_COOKIE,
        csrf,
        httponly=False,
        max_age=3600,
        path="/",
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        domain=settings.cookie_domain or None,
    )
    return {"csrfToken": csrf}


@router.get("/entra/login")
async def entra_login(response: Response) -> RedirectResponse:
    """Start Microsoft Entra OIDC authorization-code + PKCE flow."""
    settings = entra_oidc.require_entra_settings()
    state = entra_oidc.new_oidc_state()
    verifier, challenge = entra_oidc.new_pkce_pair()
    authorize_url = entra_oidc.build_authorize_redirect_url(
        state=state,
        code_challenge=challenge,
        settings=settings,
    )
    redirect = RedirectResponse(url=authorize_url, status_code=status.HTTP_302_FOUND)
    redirect.set_cookie(
        entra_oidc.OIDC_COOKIE,
        entra_oidc.pack_oidc_cookie(state, verifier),
        httponly=True,
        max_age=entra_oidc.OIDC_COOKIE_MAX_AGE,
        path="/",
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        domain=settings.cookie_domain or None,
    )
    return redirect


@router.get("/entra/callback")
async def entra_callback(
    request: Request,
    session: DbSession,
    response: Response,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
) -> RedirectResponse:
    """Complete Entra OIDC login: validate id_token, issue app session cookies."""
    if error:
        redirect = _fe_redirect("sso_failed")
        _clear_oidc_cookie(redirect)
        return redirect
    if not code or not state:
        redirect = _fe_redirect("sso_failed")
        _clear_oidc_cookie(redirect)
        return redirect

    packed = entra_oidc.unpack_oidc_cookie(request.cookies.get(entra_oidc.OIDC_COOKIE))
    if packed is None or packed[0] != state:
        redirect = _fe_redirect("sso_failed")
        _clear_oidc_cookie(redirect)
        return redirect
    _, code_verifier = packed

    try:
        tokens = await entra_oidc.exchange_code_for_tokens(
            code=code,
            code_verifier=code_verifier,
        )
        claims = entra_oidc.validate_id_token(str(tokens["id_token"]))
        email = entra_oidc.email_from_id_token_claims(claims)
        result = await _auth.issue_session_for_identity(
            session,
            provider=entra_oidc.IDENTITY_PROVIDER,
            subject=str(claims.get("oid") or "") or None,
            email=email,
            display_name=str(claims.get("name") or "") or None,
            user_agent=request.headers.get("user-agent"),
        )
    except HTTPException as exc:
        detail = str(exc.detail or "")
        code_key = "not_provisioned" if detail == "not_provisioned" else "sso_failed"
        redirect = _fe_redirect(code_key)
        _clear_oidc_cookie(redirect)
        return redirect
    except Exception:
        redirect = _fe_redirect("sso_failed")
        _clear_oidc_cookie(redirect)
        return redirect

    redirect = _fe_redirect()
    set_auth_cookies(redirect, access_token=result["token"])
    _clear_oidc_cookie(redirect)
    return redirect


@router.get("/me")
async def me(session: DbSession, user: CurrentUser) -> dict:
    await _auth.require_active_session(session, user)
    return await _auth.me(session, user)


@router.get("/bootstrap")
async def bootstrap(session: DbSession, user: CurrentUser) -> dict:
    """``/auth/me`` plus managing option, own profile, company and queue count."""
    from app.modules.auth.bootstrap import bootstrap as build_bootstrap

    return await build_bootstrap(session, user)


@router.post("/switch-view")
async def switch_view(
    body: SwitchViewBody,
    session: DbSession,
    user: CurrentUser,
    response: Response,
) -> dict:
    """Allowlisted employees: switch between the Superadmin and Employee views."""
    result = await _auth.switch_view(session, user, body.view)
    token = result.pop("token", None)
    if token:
        set_auth_cookies(response, access_token=token)
    return result


@router.patch("/theme-preference", response_model=ThemePreferenceResponse)
async def update_theme_preference(
    body: ThemePreferenceRequest,
    session: DbSession,
    user: CurrentUser,
) -> dict:
    await _auth.require_active_session(session, user)
    return await _auth.update_theme_preference(
        session, user, body.themePreference
    )


@router.patch(
    "/quick-actions-preference",
    response_model=QuickActionsPreferenceResponse,
)
async def update_quick_actions_preference(
    body: QuickActionsPreferenceRequest,
    session: DbSession,
    user: CurrentUser,
) -> dict:
    await _auth.require_active_session(session, user)
    return await _auth.update_quick_actions_preference(
        session, user, body.quickActionsPreference
    )


@router.post("/logout")
async def logout(
    session: DbSession,
    user: CurrentUser,
    response: Response,
) -> dict:
    result = await _auth.logout(session, user)
    clear_auth_cookies(response)
    return result


@router.patch("/forgot-password")
async def forgot_password(session: DbSession, body: ForgotPasswordBody) -> dict:
    """Password recovery is not used with Entra-only sign-in."""
    return {
        "message": "Sign in with Microsoft. Contact your admin if you cannot access your account."
    }


@router.patch("/reset-password")
async def reset_password(
    session: DbSession, user: CurrentUser, body: PasswordResetBody
) -> dict:
    """Change local password hash for invite-era accounts (optional)."""
    return await _employees.reset_password(
        session, user, body.password, body.temp_password or ""
    )


