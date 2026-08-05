import uvicorn
from fastapi import FastAPI

from app.api.router import api_router
from app.core.errors import register_exception_handlers
from app.core.request_id import RequestIdMiddleware
from config.settings import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, version=settings.app_version)
    app.add_middleware(RequestIdMiddleware)
    register_exception_handlers(app)
    app.include_router(api_router)
    return app


app = create_app()


if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run("main:app", host=settings.backend_host, port=settings.backend_port)
