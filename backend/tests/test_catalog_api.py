from collections.abc import Generator

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.dependencies import get_session
from app.models import Base, KnowledgeVersion, Question, QuizSet
from main import create_app


def make_client() -> tuple[TestClient, sessionmaker[Session]]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    app = create_app()

    def session_override() -> Generator[Session, None, None]:
        with sessions() as database:
            yield database

    app.dependency_overrides[get_session] = session_override
    return TestClient(app, raise_server_exceptions=False), sessions


def test_quiz_topics_returns_published_metadata_without_answers() -> None:
    client, sessions = make_client()
    with sessions() as database:
        knowledge_version = KnowledgeVersion(
            id="knowledge-2026-08",
            label="正式知识库",
            status="published",
            is_active=True,
        )
        quiz_set = QuizSet(
            id="pet-nutrition",
            knowledge_version=knowledge_version,
            label="宠物营养",
            description="宠物食品与营养知识专题",
            status="published",
        )
        quiz_set.questions.append(
            Question(
                id="question-secret",
                prompt="不可出现在目录中的完整题目",
                question_type="single_choice",
                options=["幼猫粮", "成猫粮"],
                correct_answers=["幼猫粮"],
                status="published",
            )
        )
        database.add(quiz_set)
        database.commit()

    response = client.get("/api/v1/quiz/topics")

    assert response.status_code == 200
    assert response.json() == {
        "topics": [
            {
                "id": "pet-nutrition",
                "label": "宠物营养",
                "question_count": 1,
                "description": "宠物食品与营养知识专题",
            }
        ],
        "knowledge_version": "knowledge-2026-08",
    }
    response_text = response.text.lower()
    assert "correct_answers" not in response_text
    assert "question-secret" not in response_text


def test_quiz_topics_returns_empty_catalog_when_nothing_is_published() -> None:
    client, _ = make_client()

    response = client.get("/api/v1/quiz/topics")

    assert response.status_code == 200
    assert response.json() == {"topics": [], "knowledge_version": None}
