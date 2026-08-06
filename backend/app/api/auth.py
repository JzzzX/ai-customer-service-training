from datetime import UTC, datetime, timedelta
from secrets import token_urlsafe

from fastapi import APIRouter, Cookie, Depends, Query, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.dependencies import auth_required, get_current_user, get_session
from app.core.errors import AppError
from app.core.security import TokenError, create_token, decode_token
from app.models import User
from app.repositories.users import UserRepository
from app.schemas.auth import CurrentUserResponse
from app.utils.feishu_oauth import FeishuOAuthClient, FeishuOAuthError
from config.settings import Settings, get_settings

router = APIRouter(prefix="/auth", tags=["authentication"])


def get_feishu_client(
    settings: Settings = Depends(get_settings),
) -> FeishuOAuthClient:
    return FeishuOAuthClient(settings)


@router.get("/feishu/login")
def feishu_login(
    settings: Settings = Depends(get_settings),
    client: FeishuOAuthClient = Depends(get_feishu_client),
) -> RedirectResponse:
    state = token_urlsafe(24)
    state_token = create_token(
        subject=state,
        token_type="oauth_state",
        settings=settings,
        expires_delta=timedelta(minutes=10),
    )
    response = RedirectResponse(client.authorization_url(state))
    response.set_cookie(
        "oauth_state",
        state_token,
        max_age=600,
        httponly=True,
        secure=settings.app_env == "production",
        samesite="lax",
    )
    return response


@router.get("/feishu/callback")
def feishu_callback(
    code: str = Query(min_length=1),
    state: str = Query(min_length=1),
    oauth_state: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
    client: FeishuOAuthClient = Depends(get_feishu_client),
) -> RedirectResponse:
    if not oauth_state:
        raise invalid_oauth_state()
    try:
        state_claims = decode_token(
            oauth_state, expected_type="oauth_state", settings=settings
        )
    except TokenError as error:
        raise invalid_oauth_state() from error
    if state_claims.subject != state:
        raise invalid_oauth_state()

    try:
        profile = client.exchange_code(code)
    except FeishuOAuthError as error:
        raise AppError(
            code="FEISHU_AUTH_FAILED",
            message="飞书登录暂时失败，请重试。",
            status_code=502,
        ) from error
    user = UserRepository(session).resolve_feishu_user(
        union_id=profile.union_id,
        open_id=profile.open_id,
        verified_email=profile.email,
    )
    if not user:
        raise AppError(
            code="FEISHU_ACCOUNT_NOT_BOUND",
            message="该飞书账号尚未绑定系统账号，请联系管理员。",
            status_code=403,
        )
    user.last_login_at = datetime.now(UTC)
    response = RedirectResponse(f"{settings.frontend_origin.rstrip('/')}/")
    set_session_cookies(response, user=user, settings=settings)
    response.delete_cookie("oauth_state")
    return response


@router.get("/me", response_model=CurrentUserResponse)
def current_user(user: User = Depends(get_current_user)) -> CurrentUserResponse:
    return CurrentUserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
    )


@router.post("/refresh", status_code=204)
def refresh_session(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> None:
    if not refresh_token:
        raise auth_required()
    try:
        claims = decode_token(
            refresh_token, expected_type="refresh", settings=settings
        )
    except TokenError as error:
        raise auth_required() from error
    user = UserRepository(session).get(claims.subject)
    if not user or not user.is_active or user.role != claims.role:
        raise auth_required()
    set_session_cookies(response, user=user, settings=settings)


@router.post("/logout", status_code=204)
def logout(response: Response) -> None:
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")


def set_session_cookies(
    response: Response, *, user: User, settings: Settings
) -> None:
    secure = settings.app_env == "production"
    access_seconds = settings.jwt_access_minutes * 60
    refresh_seconds = settings.jwt_refresh_days * 24 * 60 * 60
    response.set_cookie(
        "access_token",
        create_token(
            subject=user.id,
            token_type="access",
            role=user.role,
            settings=settings,
            expires_delta=timedelta(seconds=access_seconds),
        ),
        max_age=access_seconds,
        httponly=True,
        secure=secure,
        samesite="lax",
    )
    response.set_cookie(
        "refresh_token",
        create_token(
            subject=user.id,
            token_type="refresh",
            role=user.role,
            settings=settings,
            expires_delta=timedelta(seconds=refresh_seconds),
        ),
        max_age=refresh_seconds,
        httponly=True,
        secure=secure,
        samesite="lax",
    )


def invalid_oauth_state() -> AppError:
    return AppError(
        code="INVALID_OAUTH_STATE",
        message="登录状态已失效，请重新发起飞书登录。",
        status_code=401,
    )
