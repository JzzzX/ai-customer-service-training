from collections.abc import Generator
from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.dependencies import get_session
from app.core.security import create_token
from app.models import Base, KnowledgeVersion, Question, QuizSet, User
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


def seed_catalog(sessions: sessionmaker[Session]) -> None:
    with sessions() as database:
        learner = User(
            id="learner-1",
            email="one@example.test",
            name="学员一",
            role="learner",
            is_active=True,
        )
        version = KnowledgeVersion(
            id="knowledge-v1",
            version_hash="a" * 64,
            label="正式知识库",
            status="published",
            is_active=True,
        )
        quiz_set = QuizSet(
            id="set-returns",
            topic_key="returns",
            quiz_hash="b" * 64,
            knowledge_version=version,
            label="退换货",
            passing_score=80,
            status="published",
        )
        quiz_set.questions = [
            Question(
                id=f"question-{index}",
                question_key=f"legacy-{index}",
                prompt=f"题目 {index}",
                question_type="single_choice",
                options=[f"A{index}", f"B{index}"],
                correct_answers=[f"A{index}"],
                explanation=f"解析 {index}",
                category="returns",
                difficulty="easy",
                position=index + 1,
                status="published",
            )
            for index in range(2)
        ]
        database.add_all([learner, quiz_set])
        database.commit()


def login(client: TestClient, settings: Settings) -> None:
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


def test_quiz_attempt_routes_require_login() -> None:
    client, _, _ = make_client()

    start = client.post("/api/v1/quiz/topics/returns/attempts")
    progress = client.get("/api/v1/me/quiz-progress")

    assert start.status_code == 401
    assert progress.status_code == 401
    assert start.json()["code"] == "AUTH_REQUIRED"


def test_quiz_attempt_api_hides_answers_then_returns_server_scoring() -> None:
    client, settings, sessions = make_client()
    seed_catalog(sessions)
    login(client, settings)

    start = client.post("/api/v1/quiz/topics/returns/attempts")

    assert start.status_code == 200
    assert "correct_answers" not in start.text
    questions = start.json()["questions"]
    submit = client.post(
        f"/api/v1/quiz/attempts/{start.json()['attempt_id']}/submit",
        json={
            "answers": [
                {
                    "question_id": question["id"],
                    "selected_answers": [f"A{question['id'].rsplit('-', 1)[-1]}"],
                }
                for question in questions
            ]
        },
    )
    progress = client.get("/api/v1/me/quiz-progress")

    assert submit.status_code == 200
    assert submit.json()["score"] == 100
    assert submit.json()["status"] == "passed"
    assert submit.json()["answers"][0]["correct_answers"]
    assert progress.status_code == 200
    assert progress.json()["unique_answered_count"] == 2
    assert progress.json()["accuracy"] == 100


def test_quiz_attempt_api_rejects_incomplete_submission() -> None:
    client, settings, sessions = make_client()
    seed_catalog(sessions)
    login(client, settings)
    start = client.post("/api/v1/quiz/topics/returns/attempts").json()

    response = client.post(
        f"/api/v1/quiz/attempts/{start['attempt_id']}/submit",
        json={"answers": []},
    )

    assert response.status_code == 400
    assert response.json()["code"] == "QUIZ_ATTEMPT_INVALID"
