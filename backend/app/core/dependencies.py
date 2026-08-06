from collections.abc import Generator

from fastapi import Cookie, Depends
from sqlalchemy.orm import Session

from app.core.database import get_database
from app.core.errors import AppError
from app.core.security import TokenError, decode_token
from app.models import User
from app.repositories.users import UserRepository
from config.settings import Settings, get_settings


def get_session() -> Generator[Session, None, None]:
    with get_database().session_scope() as session:
        yield session


def get_current_user(
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> User:
    if not access_token:
        raise auth_required()
    try:
        claims = decode_token(
            access_token, expected_type="access", settings=settings
        )
    except TokenError as error:
        raise auth_required() from error
    user = UserRepository(session).get(claims.subject)
    if not user or not user.is_active or user.role != claims.role:
        raise auth_required()
    return user


def auth_required() -> AppError:
    return AppError(
        code="AUTH_REQUIRED",
        message="请先使用飞书登录。",
        status_code=401,
    )
