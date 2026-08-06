from datetime import UTC, datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, KnowledgeVersion, Scenario, ScenarioVersion, User
from app.services.scenario.mock import DeterministicMockProvider
from app.services.scenario.providers import ProviderError, ScenarioContext
from app.services.scenario.training import ScenarioTrainingService, TrainingError


def make_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def seed(database: Session) -> None:
    database.add_all(
        [
            User(id="learner-1", email="one@example.test", name="一号", role="learner", is_active=True),
            User(id="learner-2", email="two@example.test", name="二号", role="learner", is_active=True),
            KnowledgeVersion(id="knowledge-1", version_hash="k" * 64, label="正式知识", status="published", is_active=True),
            Scenario(id="scenario-1", scenario_key="returns", title="退货咨询", category="presale", summary="处理退货", status="published"),
        ]
    )
    database.flush()
    database.add(
        ScenarioVersion(
            id="version-1",
            scenario_id="scenario-1",
            version_key="returns-v1",
            version=1,
            knowledge_version_id="knowledge-1",
            opening_message="您好，请问有什么可以帮您？",
            customer_turns=["我想退货", "需要什么材料？", "多久能处理？"],
            scoring_dimensions=[
                {"name": "需求确认", "weight": 25, "signals": ["订单", "确认"]},
                {"name": "规则说明", "weight": 20, "signals": ["规则", "说明"]},
                {"name": "处理路径", "weight": 20, "signals": ["工单", "联系"]},
                {"name": "沟通体验", "weight": 20, "signals": ["理解", "抱歉"]},
                {"name": "闭环", "weight": 15, "signals": ["跟进", "确认"]},
            ],
            scoring_weights={"需求确认": 25},
            critical_risks=[{"label": "虚构承诺", "patterns": ["保证今天到"]}],
            reference_flow=["确认订单", "说明规则", "约定跟进", "确认结束"],
            reference_reply="请提供订单号，我帮您核实。",
            sources=[],
            status="published",
            published_at=datetime(2026, 8, 6, tzinfo=UTC),
        )
    )
    database.commit()


class FailingConversation:
    def stream_customer_reply(self, *_args, **_kwargs):
        raise ProviderError("SCENARIO_AI_TIMEOUT", "超时", retryable=True)


class FailingEvaluation:
    def evaluate(self, *_args, **_kwargs):
        raise ProviderError("SCENARIO_AI_INVALID_RESPONSE", "解析失败", retryable=True)


class FailingRisk:
    def detect_risk(self, *_args, **_kwargs):
        raise ProviderError("SCENARIO_AI_TIMEOUT", "风险服务超时", retryable=True)


def service(database: Session, **providers) -> ScenarioTrainingService:
    mock = DeterministicMockProvider()
    return ScenarioTrainingService(
        database,
        conversation_provider=providers.get("conversation", mock),
        risk_provider=providers.get("risk", mock),
        evaluation_provider=providers.get("evaluation", mock),
    )


def test_start_load_and_send_message_restore_ordered_session() -> None:
    database = make_session()
    seed(database)
    training = service(database)

    started = training.start("learner-1", "scenario-1")
    sent = training.send_message("learner-1", started.id, "我先确认订单号。", expected_turn_count=0)
    database.commit()
    loaded = training.load("learner-1", started.id)

    assert started.messages[0].sender == "customer"
    assert sent.session.turn_count == 1
    assert [message.sender for message in loaded.messages] == ["customer", "learner", "customer"]
    assert loaded.messages[-1].content == "我想退货"


def test_service_rejects_cross_user_and_stale_turn() -> None:
    database = make_session()
    seed(database)
    training = service(database)
    started = training.start("learner-1", "scenario-1")

    with pytest.raises(TrainingError) as owner_error:
        training.load("learner-2", started.id)
    assert owner_error.value.code == "SCENARIO_SESSION_NOT_FOUND"

    with pytest.raises(TrainingError) as stale_error:
        training.send_message("learner-1", started.id, "重复提交", expected_turn_count=1)
    assert stale_error.value.code == "SCENARIO_STALE_TURN"


def test_risk_provider_failure_does_not_block_exchange() -> None:
    database = make_session()
    seed(database)
    training = service(database, risk=FailingRisk())
    started = training.start("learner-1", "scenario-1")

    sent = training.send_message("learner-1", started.id, "我先确认订单号。", expected_turn_count=0)

    assert sent.risk_alert is None
    assert len(sent.session.messages) == 3


def test_conversation_failure_preserves_existing_messages_and_is_retryable() -> None:
    database = make_session()
    seed(database)
    training = service(database, conversation=FailingConversation())
    started = training.start("learner-1", "scenario-1")

    with pytest.raises(TrainingError) as error:
        training.send_message("learner-1", started.id, "我先确认订单号。", expected_turn_count=0)
    database.refresh(started)

    assert error.value.code == "SCENARIO_AI_TIMEOUT"
    assert error.value.retryable is True
    assert started.turn_count == 0
    assert len(started.messages) == 1


def test_complete_is_idempotent_and_sse_events_have_report_once() -> None:
    database = make_session()
    seed(database)
    training = service(database)
    started = training.start("learner-1", "scenario-1")
    training.send_message("learner-1", started.id, "我确认订单并说明规则，后续跟进。", expected_turn_count=0)
    database.commit()

    events = list(training.complete_stream("learner-1", started.id))
    repeated = training.complete("learner-1", started.id)
    database.commit()

    assert [event["event"] for event in events] == ["analyzing", "scoring", "saving", "report"]
    assert events[-1]["report"]["total_score"] >= 0
    assert repeated.report.id == events[-1]["report"]["id"]
    assert database.query(type(repeated.report)).count() == 1


def test_report_failure_can_be_retried_without_duplicate_messages() -> None:
    database = make_session()
    seed(database)
    failing = service(database, evaluation=FailingEvaluation())
    started = failing.start("learner-1", "scenario-1")
    failing.send_message("learner-1", started.id, "我先确认订单。", expected_turn_count=0)
    database.commit()

    with pytest.raises(TrainingError) as error:
        failing.complete("learner-1", started.id)
    assert error.value.code == "SCENARIO_REPORT_FAILED"
    assert error.value.retryable is True

    recovered = service(database)
    completed = recovered.complete("learner-1", started.id)
    database.commit()

    assert completed.status == "completed"
    assert len(completed.messages) == 3
    assert completed.report is not None
