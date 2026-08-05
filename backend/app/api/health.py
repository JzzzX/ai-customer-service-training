from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import Database, get_database
from app.core.errors import AppError
from app.schemas.health import HealthResponse, ReadinessResponse
from config.settings import Settings, get_settings

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse)
def health(settings: Settings = Depends(get_settings)) -> HealthResponse:
    return HealthResponse(
        service=settings.app_name,
        status="ok",
        version=settings.app_version,
    )


@router.get("/ready", response_model=ReadinessResponse)
def ready(
    settings: Settings = Depends(get_settings),
    database: Database = Depends(get_database),
) -> ReadinessResponse:
    try:
        with database.session_scope() as session:
            session.execute(text("SELECT 1")).scalar_one()
    except SQLAlchemyError as error:
        raise AppError(
            code="DATABASE_UNAVAILABLE",
            message="数据库暂不可用。",
            status_code=503,
        ) from error
    return ReadinessResponse(
        service=settings.app_name,
        status="ready",
        database="ok",
    )
