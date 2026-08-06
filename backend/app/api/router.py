from fastapi import APIRouter

from app.api.auth import router as auth_router
from app.api.catalog import router as catalog_router
from app.api.health import router as health_router
from app.api.overview import router as overview_router
from app.api.quiz import router as quiz_router
from app.api.scenario import router as scenario_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(overview_router)
api_router.include_router(catalog_router)
api_router.include_router(quiz_router)
api_router.include_router(scenario_router)
