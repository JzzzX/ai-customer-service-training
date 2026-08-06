import json

import pytest

from app.services.scenario.ark import ArkScenarioProvider
from app.services.scenario.mock import DeterministicMockProvider
from app.services.scenario.providers import (
    ChatMessage,
    ProviderError,
    RiskAlert,
    ScenarioContext,
)
from config.settings import Settings


def context() -> ScenarioContext:
    return ScenarioContext(
        id="scenario-1",
        title="退货咨询",
        summary="处理退货",
        opening_message="您好",
        customer_turns=["我想退货", "需要什么材料？", "多久能处理？"],
        scoring_dimensions=[
            {"name": "需求确认", "weight": 25, "signals": ["订单", "确认"]},
            {"name": "规则说明", "weight": 20, "signals": ["规则", "说明"]},
            {"name": "处理路径", "weight": 20, "signals": ["工单", "联系"]},
            {"name": "沟通体验", "weight": 20, "signals": ["理解", "抱歉"]},
            {"name": "闭环", "weight": 15, "signals": ["跟进", "确认"]},
        ],
        critical_risks=[{"label": "虚构承诺", "patterns": ["保证今天到"]}],
        reference_flow=["确认订单", "说明规则", "约定跟进", "确认结束"],
        reference_reply="请提供订单号，我帮您核实。",
        max_turns=12,
    )


def test_mock_customer_reply_is_deterministic_and_chunked() -> None:
    provider = DeterministicMockProvider()
    messages = [ChatMessage(sender="customer", content="您好")]

    first = list(provider.stream_customer_reply(context(), messages, learner_turn_count=0))
    second = list(provider.stream_customer_reply(context(), messages, learner_turn_count=0))

    assert "".join(first) == "我想退货"
    assert first == second
    assert len(first) >= 2


def test_mock_evaluation_scores_signals_and_low_confidence() -> None:
    provider = DeterministicMockProvider()
    messages = [
        ChatMessage(sender="customer", content="您好"),
        ChatMessage(sender="learner", content="我先确认订单，再说明规则，后续跟进。"),
    ]

    report = provider.evaluate(context(), messages)

    assert report.total_score > 0
    assert report.verdict == "needs_retry"
    assert report.low_confidence is True
    assert len(report.dimensions) == 5


def test_mock_risk_detection_returns_danger_alert() -> None:
    provider = DeterministicMockProvider()
    messages = [ChatMessage(sender="learner", content="我保证今天到。")]

    alert = provider.detect_risk(context(), messages)

    assert alert is not None
    assert alert.risk_label == "虚构承诺"
    assert alert.severity == "danger"


def test_ark_provider_maps_timeout_and_never_falls_back_to_mock() -> None:
    def timeout(_request, _timeout):
        raise TimeoutError("upstream timeout")

    provider = ArkScenarioProvider(
        Settings(
            app_env="test",
            database_url="sqlite+pysqlite:///:memory:",
            scenario_ai_mode="ark",
            ark_base_url="https://ark.example.test",
            ark_api_key="secret",
            ark_model="doubao-test",
        ),
        request_fn=timeout,
    )

    with pytest.raises(ProviderError) as error:
        list(provider.stream_customer_reply(context(), [], learner_turn_count=0))

    assert error.value.code == "SCENARIO_AI_TIMEOUT"
    assert error.value.retryable is True


def test_ark_provider_parses_json_and_rejects_empty_response() -> None:
    responses = [
        json.dumps({"choices": [{"message": {"content": "顾客回复"}}]}).encode(),
        b"",
    ]

    def request(_request, _timeout):
        return responses.pop(0)

    settings = Settings(
        app_env="test",
        database_url="sqlite+pysqlite:///:memory:",
        scenario_ai_mode="ark",
        ark_base_url="https://ark.example.test",
        ark_api_key="secret",
        ark_model="doubao-test",
    )
    provider = ArkScenarioProvider(settings, request_fn=request)

    assert list(provider.stream_customer_reply(context(), [], learner_turn_count=0)) == ["顾客回复"]
    with pytest.raises(ProviderError) as error:
        list(provider.stream_customer_reply(context(), [], learner_turn_count=0))
    assert error.value.code == "SCENARIO_AI_EMPTY_RESPONSE"
