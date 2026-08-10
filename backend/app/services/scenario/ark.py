from __future__ import annotations

from collections.abc import Callable, Iterable, Sequence
import json
from urllib.error import URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from config.settings import Settings

from app.services.scenario.providers import (
    ChatMessage,
    ConversationProvider,
    EvaluationReportDraft,
    EvaluationProvider,
    LiveRiskProvider,
    ProviderError,
    RiskAlert,
    ScenarioContext,
)


RequestFunction = Callable[[Request, float], bytes]


class ArkScenarioProvider(ConversationProvider, LiveRiskProvider, EvaluationProvider):
    def __init__(self, settings: Settings, *, request_fn: RequestFunction | None = None) -> None:
        self.settings = settings
        self.request_fn = request_fn or _default_request

    def stream_customer_reply(
        self,
        scenario: ScenarioContext,
        messages: Sequence[ChatMessage],
        learner_turn_count: int,
    ) -> Iterable[str]:
        content = self._complete(
            "customer_reply",
            {"scenario": _scenario_payload(scenario), "messages": _messages_payload(messages), "learner_turn_count": learner_turn_count},
        )
        yield content

    def detect_risk(
        self, scenario: ScenarioContext, messages: Sequence[ChatMessage]
    ) -> RiskAlert | None:
        raw = self._complete(
            "risk_detection",
            {"scenario": _scenario_payload(scenario), "messages": _messages_payload(messages)},
        )
        if raw.strip().lower() in {"null", "none", "no_risk"}:
            return None
        data = _parse_json(raw, code="SCENARIO_AI_INVALID_RESPONSE")
        if not data or not data.get("risk_label"):
            return None
        return RiskAlert(
            risk_label=str(data["risk_label"]),
            suggestion=str(data.get("suggestion", "请先核实事实并说明下一步。")),
            severity=str(data.get("severity", "warning")),
        )

    def evaluate(
        self, scenario: ScenarioContext, messages: Sequence[ChatMessage]
    ) -> EvaluationReportDraft:
        raw = self._complete(
            "evaluation",
            {"scenario": _scenario_payload(scenario), "messages": _messages_payload(messages)},
        )
        data = _parse_json(raw, code="SCENARIO_AI_INVALID_RESPONSE")
        try:
            return EvaluationReportDraft(
                total_score=int(data["total_score"]),
                verdict=str(data["verdict"]),
                confidence=float(data["confidence"]),
                dimensions=list(data["dimensions"]),
                strengths=list(data.get("strengths", [])),
                omissions=list(data.get("omissions", [])),
                risks=list(data.get("risks", [])),
                recommendations=list(data.get("recommendations", [])),
                reference_reply=str(data.get("reference_reply", scenario.reference_reply)),
                low_confidence=bool(data.get("low_confidence", False)),
            )
        except (KeyError, TypeError, ValueError) as error:
            raise ProviderError(
                "SCENARIO_AI_INVALID_RESPONSE",
                "Ark 评测响应字段不完整。",
                retryable=True,
            ) from error

    def _complete(self, operation: str, payload: dict[str, object]) -> str:
        if self.settings.scenario_ai_mode != "ark" or not self.settings.ark_base_url or not self.settings.ark_api_key or not self.settings.ark_model:
            raise ProviderError("SCENARIO_AI_NOT_CONFIGURED", "Ark Provider 尚未完成配置。", retryable=False)
        body = {
            "model": self.settings.ark_model,
            "messages": [{"role": "user", "content": json.dumps({"operation": operation, **payload}, ensure_ascii=False)}],
        }
        request = Request(
            urljoin(self.settings.ark_base_url.rstrip("/") + "/", "chat/completions"),
            data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
            headers={"Authorization": f"Bearer {self.settings.ark_api_key}", "Content-Type": "application/json"},
            method="POST",
        )
        try:
            raw = self.request_fn(request, float(self.settings.ark_timeout_seconds))
        except (TimeoutError, TimeoutError) as error:
            raise ProviderError("SCENARIO_AI_TIMEOUT", "Ark 请求超时，可重试。", retryable=True) from error
        except URLError as error:
            raise ProviderError("SCENARIO_AI_UNAVAILABLE", "Ark 服务暂时不可用，可重试。", retryable=True) from error
        except OSError as error:
            raise ProviderError("SCENARIO_AI_UNAVAILABLE", "Ark 服务暂时不可用，可重试。", retryable=True) from error
        if not raw:
            raise ProviderError("SCENARIO_AI_EMPTY_RESPONSE", "Ark 返回了空响应，可重试。", retryable=True)
        response = _parse_json(raw.decode("utf-8", errors="replace"), code="SCENARIO_AI_INVALID_RESPONSE")
        try:
            content = response["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as error:
            raise ProviderError("SCENARIO_AI_INVALID_RESPONSE", "Ark 响应格式无法识别。", retryable=True) from error
        if not isinstance(content, str) or not content.strip():
            raise ProviderError("SCENARIO_AI_EMPTY_RESPONSE", "Ark 返回了空内容，可重试。", retryable=True)
        return content.strip()


def _default_request(request: Request, timeout: float) -> bytes:
    with urlopen(request, timeout=timeout) as response:
        return response.read()


def _parse_json(raw: str, *, code: str) -> dict[str, object]:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").removeprefix("json").strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as error:
        raise ProviderError(code, "Ark 返回内容不是有效 JSON。", retryable=True) from error
    if not isinstance(data, dict):
        raise ProviderError(code, "Ark 返回内容不是对象。", retryable=True)
    return data


def _scenario_payload(scenario: ScenarioContext) -> dict[str, object]:
    return {
        "id": scenario.id,
        "title": scenario.title,
        "summary": scenario.summary,
        "opening_message": scenario.opening_message,
        "customer_turns": scenario.customer_turns,
        "scoring_dimensions": scenario.scoring_dimensions,
        "critical_risks": scenario.critical_risks,
        "reference_flow": scenario.reference_flow,
        "reference_reply": scenario.reference_reply,
    }


def _messages_payload(messages: Sequence[ChatMessage]) -> list[dict[str, str]]:
    return [{"sender": message.sender, "content": message.content} for message in messages]
