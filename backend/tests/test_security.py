from datetime import timedelta

import pytest

from app.core.security import TokenError, create_token, decode_token
from config.settings import Settings


def settings() -> Settings:
    return Settings(
        app_env="test",
        database_url="sqlite+pysqlite:///:memory:",
        jwt_secret="test-secret-that-is-long-enough-for-signing",
    )


def test_access_token_round_trip_preserves_identity_and_role() -> None:
    token = create_token(
        subject="00000000-0000-4000-8000-000000000002",
        token_type="access",
        settings=settings(),
        expires_delta=timedelta(minutes=15),
        role="learner",
    )

    claims = decode_token(token, expected_type="access", settings=settings())

    assert claims.subject == "00000000-0000-4000-8000-000000000002"
    assert claims.role == "learner"


def test_token_type_cannot_be_reused_for_another_purpose() -> None:
    token = create_token(
        subject="user-1",
        token_type="oauth_state",
        settings=settings(),
        expires_delta=timedelta(minutes=10),
    )

    with pytest.raises(TokenError):
        decode_token(token, expected_type="access", settings=settings())


def test_production_rejects_a_short_jwt_secret() -> None:
    with pytest.raises(ValueError):
        Settings(
            app_env="production",
            database_url="mysql+pymysql://user:pass@db/app",
            jwt_secret="short",
        )
