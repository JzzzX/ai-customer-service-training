from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal

from jose import JWTError, jwt

from config.settings import Settings

TokenType = Literal["access", "refresh", "oauth_state"]


class TokenError(ValueError):
    pass


@dataclass(frozen=True)
class TokenClaims:
    subject: str
    token_type: TokenType
    role: str | None = None


def create_token(
    *,
    subject: str,
    token_type: TokenType,
    settings: Settings,
    expires_delta: timedelta,
    role: str | None = None,
) -> str:
    now = datetime.now(UTC)
    payload: dict[str, object] = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    if role:
        payload["role"] = role
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_token(
    token: str, *, expected_type: TokenType, settings: Settings
) -> TokenClaims:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except JWTError as error:
        raise TokenError("invalid token") from error
    if payload.get("type") != expected_type or not payload.get("sub"):
        raise TokenError("invalid token purpose")
    return TokenClaims(
        subject=str(payload["sub"]),
        token_type=expected_type,
        role=str(payload["role"]) if payload.get("role") else None,
    )
