from typing import Any
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.schemas.error import ErrorResponse


class AppError(Exception):
    def __init__(
        self,
        *,
        code: str,
        message: str,
        status_code: int,
        details: Any | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", uuid4().hex)


def _response(
    request: Request,
    *,
    status_code: int,
    code: str,
    message: str,
    details: Any | None,
) -> JSONResponse:
    payload = ErrorResponse(
        code=code,
        message=message,
        details=details,
        request_id=_request_id(request),
    )
    return JSONResponse(status_code=status_code, content=payload.model_dump(mode="json"))


async def handle_app_error(request: Request, error: AppError) -> JSONResponse:
    return _response(
        request,
        status_code=error.status_code,
        code=error.code,
        message=error.message,
        details=error.details,
    )


async def handle_validation_error(
    request: Request,
    error: RequestValidationError,
) -> JSONResponse:
    return _response(
        request,
        status_code=422,
        code="VALIDATION_ERROR",
        message="请求参数不正确。",
        details=error.errors(),
    )


async def handle_unexpected_error(
    request: Request,
    _error: Exception,
) -> JSONResponse:
    return _response(
        request,
        status_code=500,
        code="INTERNAL_ERROR",
        message="服务暂时不可用，请稍后重试。",
        details=None,
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, handle_app_error)
    app.add_exception_handler(RequestValidationError, handle_validation_error)
    app.add_exception_handler(Exception, handle_unexpected_error)
