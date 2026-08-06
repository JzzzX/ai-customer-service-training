from datetime import UTC, datetime

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    Base,
    EvaluationReport,
    KnowledgeVersion,
    Scenario,
    ScenarioVersion,
    TrainingMessage,
    TrainingSession,
    User,
)


def make_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(dbapi_connection, _connection_record) -> None:
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    return Session(engine)


def make_fixture(database: Session) -> tuple[User, ScenarioVersion]:
    learner = User(
        id="learner-1",
        email="learner@example.test",
        name="测试学员",
        role="learner",
        is_active=True,
    )
    scenario = Scenario(
        id="scenario-1",
        scenario_key="returns",
        title="退货咨询",
        category="presale",
        summary="处理退货时效咨询",
        status="published",
    )
    version = ScenarioVersion(
        id="scenario-version-1",
        scenario=scenario,
        version_key="returns-v1",
        version=1,
        knowledge_version_id="knowledge-v1",
        opening_message="您好，请问有什么可以帮您？",
        customer_turns=["我想退货", "还需要什么材料？"],
        scoring_dimensions=[{"key": "policy", "weight": 100}],
        scoring_weights={"policy": 100},
        critical_risks=["承诺无法兑现"],
        reference_flow=["确认订单", "说明时效"],
        reference_reply="请提供订单号，我帮您核实。",
        sources=[{"source_locator": "faq.md#returns"}],
        status="published",
        published_at=datetime(2026, 8, 6, tzinfo=UTC),
    )
    database.add_all([learner, scenario, version])
    database.add(
        KnowledgeVersion(
            id="knowledge-v1",
            version_hash="k" * 64,
            label="知识版本",
            status="published",
            is_active=True,
        )
    )
    database.commit()
    return learner, version


def test_phase4_models_preserve_version_message_order_and_report_relation() -> None:
    database = make_session()
    learner, version = make_fixture(database)
    session = TrainingSession(
        id="training-session-1",
        learner_id=learner.id,
        scenario_version_id=version.id,
        knowledge_version_id="knowledge-v1",
        status="in_progress",
        mode="mock",
        turn_count=1,
        max_turns=12,
    )
    session.messages = [
        TrainingMessage(
            id="message-0",
            position=0,
            sender="customer",
            content=version.opening_message,
        ),
        TrainingMessage(
            id="message-1",
            position=1,
            sender="learner",
            content="我想退货。",
        ),
    ]
    report = EvaluationReport(
        id="report-1",
        training_session=session,
        knowledge_version_id="knowledge-v1",
        total_score=88,
        verdict="passed",
        dimensions=[{"key": "policy", "score": 88}],
        strengths=["确认需求"],
        omissions=[],
        risks=[],
        recommendations=[],
        confidence=0.92,
        low_confidence=False,
    )
    database.add_all([session, report])
    database.commit()

    saved = database.get(TrainingSession, session.id)

    assert saved is not None
    assert [message.position for message in saved.messages] == [0, 1]
    assert saved.report.total_score == 88
    assert saved.scenario_version.scenario.scenario_key == "returns"


def test_training_message_position_is_unique_per_session() -> None:
    database = make_session()
    learner, version = make_fixture(database)
    session = TrainingSession(
        id="training-session-1",
        learner_id=learner.id,
        scenario_version_id=version.id,
        knowledge_version_id="knowledge-v1",
        status="in_progress",
        mode="mock",
        max_turns=12,
    )
    session.messages = [
        TrainingMessage(id="message-1", position=0, sender="customer", content="a"),
        TrainingMessage(id="message-2", position=0, sender="learner", content="b"),
    ]
    database.add(session)

    with pytest.raises(IntegrityError):
        database.commit()


def test_training_session_has_at_most_one_report() -> None:
    database = make_session()
    learner, version = make_fixture(database)
    session = TrainingSession(
        id="training-session-1",
        learner_id=learner.id,
        scenario_version_id=version.id,
        knowledge_version_id="knowledge-v1",
        status="completed",
        mode="mock",
        max_turns=12,
        completed_at=datetime(2026, 8, 6, tzinfo=UTC),
    )
    session.report = EvaluationReport(
        id="report-1",
        knowledge_version_id="knowledge-v1",
        total_score=80,
        verdict="passed",
        dimensions=[],
        strengths=[],
        omissions=[],
        risks=[],
        recommendations=[],
        confidence=0.8,
        low_confidence=False,
    )
    database.add(session)

    with pytest.raises(IntegrityError):
        database.add(
            EvaluationReport(
                id="report-2",
                training_session_id=session.id,
                knowledge_version_id="knowledge-v1",
                total_score=70,
                verdict="needs_retry",
                dimensions=[],
                strengths=[],
                omissions=[],
                risks=[],
                recommendations=[],
                confidence=0.7,
                low_confidence=False,
            )
        )
        database.commit()
