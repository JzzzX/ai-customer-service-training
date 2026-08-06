import pytest
from pydantic import ValidationError

from config.settings import Settings


def test_production_requires_mysql_pymysql_url() -> None:
    with pytest.raises(ValidationError):
        Settings(app_env="production", database_url="sqlite+pysqlite:///:memory:")


def test_test_environment_accepts_sqlite() -> None:
    settings = Settings(app_env="test", database_url="sqlite+pysqlite:///:memory:")

    assert settings.backend_port == 8005
    assert settings.frontend_origin == "http://localhost:8006"


def test_production_requires_feishu_credentials() -> None:
    with pytest.raises(ValidationError):
        Settings(
            app_env="production",
            database_url="mysql+pymysql://user:pass@db/app",
            jwt_secret="production-secret-that-is-long-enough-for-signing",
            feishu_app_client_id="",
            feishu_app_client_secret="",
        )
