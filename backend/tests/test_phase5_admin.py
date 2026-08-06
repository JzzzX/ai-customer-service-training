from collections.abc import Generator
from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.dependencies import get_current_user, get_session
from app.models import (
    Assignment,
    Base,
    EvaluationReport,
    KnowledgeUnit,
    KnowledgeVersion,
    Question,
    QuizSet,
    Scenario,
    ScenarioVersion,
    TrainingSession,
    User,
)
from main import create_app


def make_client(*, role: str = "admin") -> tuple[TestClient, sessionmaker[Session]]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    app = create_app()

    def session_override() -> Generator[Session, None, None]:
        database = sessions()
        try:
            yield database
            database.commit()
        finally:
            database.close()

    app.dependency_overrides[get_session] = session_override
    app.dependency_overrides[get_current_user] = lambda: User(
        id="admin-1" if role == "admin" else "learner-1",
        email="admin@example.test" if role == "admin" else "learner@example.test",
        name="管理员" if role == "admin" else "学员",
        role=role,
        is_active=True,
    )
    return TestClient(app), sessions


def seed_admin_resources(sessions: sessionmaker[Session]) -> None:
    database = sessions()
    database.add_all(
        [
            User(
                id="admin-1",
                email="admin@example.test",
                name="管理员",
                role="admin",
                is_active=True,
            ),
            User(
                id="learner-1",
                email="learner@example.test",
                name="学员",
                role="learner",
                is_active=True,
            ),
            KnowledgeVersion(
                id="knowledge-1",
                version_hash="k" * 64,
                label="正式知识",
                status="published",
                is_active=True,
            ),
            Scenario(
                id="scenario-1",
                scenario_key="returns",
                title="退货咨询",
                category="售后",
                summary="处理退货",
                status="published",
            ),
            Assignment(
                id="assignment-1",
                learner_id="learner-1",
                assigned_by_id="admin-1",
                assignment_type="scenario",
                target_id="scenario-1",
                target_label="退货咨询",
                status="assigned",
            ),
        ]
    )
    database.flush()
    unit = KnowledgeUnit(
        id="unit-1",
        knowledge_version_id="knowledge-1",
        unit_key="returns",
        title="退货规则",
        content="请先确认订单号。",
        category_path=["售后"],
        content_hash="u" * 64,
        sources=[{"source_path": "returns.md"}],
    )
    quiz_set = QuizSet(
        id="quiz-1",
        knowledge_version_id="knowledge-1",
        topic_key="returns",
        label="退货专题",
        quiz_hash="q" * 64,
        status="published",
    )
    quiz_set.questions.append(
        Question(
            id="question-1",
            question_key="returns-1",
            knowledge_unit=unit,
            prompt="第一步做什么？",
            question_type="single_choice",
            options=["确认订单", "直接承诺"],
            correct_answers=["确认订单"],
            explanation="先确认订单。",
            category="售后",
            difficulty="easy",
            position=1,
            status="published",
        )
    )
    version = ScenarioVersion(
        id="scenario-version-1",
        scenario_id="scenario-1",
        version_key="returns-v1",
        version=1,
        knowledge_version_id="knowledge-1",
        summary="退货处理",
        opening_message="您好，请问有什么可以帮您？",
        customer_turns=["我想退货"],
        scoring_dimensions=[{"key": "policy", "weight": 100}],
        scoring_weights={"policy": 100},
        status="published",
        published_at=datetime.now(UTC),
    )
    database.add_all([unit, quiz_set, version])
    database.flush()
    training_session = TrainingSession(
        id="session-1",
        learner_id="learner-1",
        scenario_version_id="scenario-version-1",
        knowledge_version_id="knowledge-1",
        status="completed",
        mode="mock",
        turn_count=1,
        max_turns=12,
        completed_at=datetime.now(UTC),
    )
    database.add(training_session)
    database.flush()
    database.add(
        EvaluationReport(
            id="report-1",
            training_session_id=training_session.id,
            knowledge_version_id="knowledge-1",
            total_score=62,
            verdict="needs_retry",
            dimensions=[{"key": "policy", "score": 62}],
            strengths=[],
            omissions=["确认订单"],
            risks=[],
            recommendations=["补充确认"],
            confidence=0.62,
            low_confidence=True,
            needs_review=True,
            review_trigger="low_confidence",
        )
    )
    database.commit()
    database.close()


def test_admin_api_rejects_learner() -> None:
    client, _ = make_client(role="learner")

    response = client.get("/api/v1/admin/overview")

    assert response.status_code == 403
    assert response.json()["code"] == "ADMIN_REQUIRED"


def test_admin_resources_and_review_decision_are_audited() -> None:
    client, sessions = make_client()
    seed_admin_resources(sessions)

    knowledge = client.get("/api/v1/admin/knowledge?limit=10")
    questions = client.get("/api/v1/admin/questions?limit=10")
    scenarios = client.get("/api/v1/admin/scenarios?limit=10")
    assignments = client.get("/api/v1/admin/assignments?limit=10")
    reviews = client.get("/api/v1/admin/reviews?status=pending&limit=10")

    assert knowledge.status_code == 200
    assert knowledge.json()["items"][0]["label"] == "正式知识"
    assert questions.json()["items"][0]["prompt"] == "第一步做什么？"
    assert scenarios.json()["items"][0]["title"] == "退货咨询"
    assert assignments.json()["items"][0]["learner_name"] == "学员"
    assert reviews.json()["items"][0]["report_id"] == "report-1"

    decision = client.post(
        "/api/v1/admin/reviews/report-1/decision",
        json={
            "status": "approved",
            "corrected_score": 78,
            "comment": "已复核并补充建议。",
        },
    )

    assert decision.status_code == 201
    assert decision.json()["status"] == "approved"
    assert client.get("/api/v1/admin/reviews?status=approved").json()["total"] == 1
    history = client.get("/api/v1/admin/history?limit=10")
    assert history.status_code == 200
    assert history.json()["items"][0]["action"] == "review_decision"


def test_phase5_audit_table_is_registered() -> None:
    assert "admin_audit_events" in Base.metadata.tables
