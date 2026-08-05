from fastapi import APIRouter
from fastapi.testclient import TestClient

from app.core.errors import AppError
from main import create_app


def make_client() -> TestClient:
    app = create_app()
    router = APIRouter(prefix="/api/v1")

    @router.get("/failure")
    def failure() -> None:
        raise AppError(
            code="FOUNDATION_FAILURE",
            message="基础服务故障。",
            status_code=409,
            details={"field": "foundation"},
        )

    @router.get("/validate/{count}")
    def validate(count: int) -> dict[str, int]:
        return {"count": count}

    app.include_router(router)
    return TestClient(app, raise_server_exceptions=False)


def test_request_id_is_preserved_on_success() -> None:
    response = make_client().get(
        "/api/v1/health", headers={"X-Request-ID": "request-fixed"}
    )

    assert response.headers["X-Request-ID"] == "request-fixed"


def test_app_error_uses_stable_envelope() -> None:
    response = make_client().get("/api/v1/failure")

    assert response.status_code == 409
    assert response.json() == {
        "code": "FOUNDATION_FAILURE",
        "message": "基础服务故障。",
        "details": {"field": "foundation"},
        "request_id": response.headers["X-Request-ID"],
    }


def test_validation_error_uses_stable_envelope() -> None:
    response = make_client().get("/api/v1/validate/not-a-number")

    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"
    assert response.json()["request_id"] == response.headers["X-Request-ID"]
    assert "traceback" not in response.text.lower()
