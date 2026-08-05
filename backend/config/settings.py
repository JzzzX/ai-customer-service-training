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

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @model_validator(mode="after")
    def require_mysql_in_production(self) -> Self:
        if self.app_env == "production" and not self.database_url.startswith(
            "mysql+pymysql://"
        ):
            raise ValueError("production DATABASE_URL must use mysql+pymysql")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
