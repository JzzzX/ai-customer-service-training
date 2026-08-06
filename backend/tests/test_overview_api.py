from collections.abc import Generator
from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.dependencies import get_session
from app.core.security import create_token
from app.models import Assignment, Base, KnowledgeProgress, ScenarioProgressSummary, User
from config.settings import Settings, get_settings
from main import create_app


def make_client() -> tuple[TestClient, Settings, sessionmaker[Session]]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    settings = Settings(
        app_env="test",
        database_url="sqlite+pysqlite:///:memory:",
        jwt_secret="test-secret-that-is-long-enough-for-signing",
    )
    app = create_app()

    def session_override() -> Generator[Session, None, None]:
        database = sessions()
        try:
            yield database
            database.commit()
        finally:
            database.close()

    app.dependency_overrides[get_session] = session_override
    app.dependency_overrides[get_settings] = lambda: settings
    return TestClient(app, raise_server_exceptions=False), settings, sessions


def test_overview_returns_user_scoped_tasks_and_progress() -> None:
    client, settings, sessions = make_client()
    with sessions() as database:
        database.add_all(
            [
                User(
                    id="learner-1",
                    email="one@example.test",
                    name="学员一",
                    role="learner",
                    is_active=True,
                ),
                User(
                    id="learner-2",
                    email="two@example.test",
                    name="学员二",
                    role="learner",
                    is_active=True,
                ),
                Assignment(
                    id="assignment-1",
                    learner_id="learner-1",
                    assigned_by_id="admin-1",
                    assignment_type="quiz",
                    target_id="quiz-1",
                    target_label="物流专题测验",
                    status="assigned",
                ),
                Assignment(
                    id="assignment-2",
                    learner_id="learner-2",
                    assigned_by_id="admin-1",
                    assignment_type="quiz",
                    target_id="quiz-2",
                    target_label="不可见任务",
                    status="assigned",
                ),
                KnowledgeProgress(
                    learner_id="learner-1",
                    total_questions=40,
                    unique_answered_count=12,
                    total_correct_answers=10,
                    total_answered_answers=12,
                    accuracy=83,
                    attempt_count=2,
                ),
                ScenarioProgressSummary(
                    learner_id="learner-1",
                    published_scenario_count=8,
                    completed_scenario_count=3,
                    completed_session_count=5,
                    recent_average_score=86,
                ),
            ]
        )
        database.commit()
    client.cookies.set(
        "access_token",
        create_token(
            subject="learner-1",
            token_type="access",
            role="learner",
            settings=settings,
            expires_delta=timedelta(minutes=15),
        ),
    )

    response = client.get("/api/v1/me/overview")

    assert response.status_code == 200
    assert response.json()["user"]["name"] == "学员一"
    assert [item["target_label"] for item in response.json()["assignments"]] == [
        "物流专题测验"
    ]
    assert response.json()["knowledge"]["unique_answered_count"] == 12
    assert response.json()["scenario"]["recent_average_score"] == 86


def test_overview_requires_login() -> None:
    client, _, _ = make_client()

    response = client.get("/api/v1/me/overview")

    assert response.status_code == 401
    assert response.json()["code"] == "AUTH_REQUIRED"
