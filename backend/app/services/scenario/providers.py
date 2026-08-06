from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class ScenarioContext:
    id: str
    title: str
    summary: str
    opening_message: str
    customer_turns: list[str]
    scoring_dimensions: list[dict[str, object]]
    critical_risks: list[dict[str, object]]
    reference_flow: list[object]
    reference_reply: str
    max_turns: int = 12


@dataclass(frozen=True)
class ChatMessage:
    sender: str
    content: str


@dataclass(frozen=True)
class RiskAlert:
    risk_label: str
    suggestion: str
    severity: str


@dataclass(frozen=True)
class EvaluationReportDraft:
    total_score: int
    verdict: str
    confidence: float
    dimensions: list[dict[str, object]]
    strengths: list[str]
    omissions: list[str]
    risks: list[str]
    recommendations: list[dict[str, str]]
    reference_reply: str
    low_confidence: bool


class ProviderError(RuntimeError):
    def __init__(self, code: str, message: str, *, retryable: bool, details: dict[str, object] | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable
        self.details = details


class ConversationProvider(Protocol):
    def stream_customer_reply(
        self,
        scenario: ScenarioContext,
        messages: Sequence[ChatMessage],
        learner_turn_count: int,
    ) -> Iterable[str]: ...


class LiveRiskProvider(Protocol):
    def detect_risk(
        self, scenario: ScenarioContext, messages: Sequence[ChatMessage]
    ) -> RiskAlert | None: ...


class EvaluationProvider(Protocol):
    def evaluate(
        self, scenario: ScenarioContext, messages: Sequence[ChatMessage]
    ) -> EvaluationReportDraft: ...
