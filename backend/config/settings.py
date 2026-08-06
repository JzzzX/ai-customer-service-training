from functools import lru_cache
from typing import Literal, Self

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ai-customer-service-training-api"
    app_version: str = "0.1.0"
    app_env: Literal["development", "test", "production"] = "development"
    backend_host: str = "127.0.0.1"
    backend_port: int = 8005
    frontend_origin: str = "http://localhost:8006"
    database_url: str = "sqlite+pysqlite:///./company-stack-dev.db"
    feishu_app_client_id: str = ""
    feishu_app_client_secret: str = ""
    feishu_redirect_uri: str = (
        "http://localhost:8005/api/v1/auth/feishu/callback"
    )
    jwt_secret: str = "development-only-secret-change-before-production"
    jwt_access_minutes: int = 15
    jwt_refresh_days: int = 7

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @model_validator(mode="after")
    def require_mysql_in_production(self) -> Self:
        if self.app_env == "production" and not self.database_url.startswith(
            "mysql+pymysql://"
        ):
            raise ValueError("production DATABASE_URL must use mysql+pymysql")
        if self.app_env == "production" and len(self.jwt_secret) < 32:
            raise ValueError("production JWT_SECRET must contain at least 32 characters")
        if self.app_env == "production" and (
            not self.feishu_app_client_id or not self.feishu_app_client_secret
        ):
            raise ValueError("production Feishu OAuth credentials are required")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
