from fastapi.testclient import TestClient

from main import create_app


def test_readiness_checks_database() -> None:
    response = TestClient(create_app()).get("/api/v1/ready")

    assert response.status_code == 200
    assert response.json() == {
        "service": "ai-customer-service-training-api",
        "status": "ready",
        "database": "ok",
    }
