from __future__ import annotations

from collections.abc import Iterable, Sequence

from app.services.scenario.providers import (
    ChatMessage,
    ConversationProvider,
    EvaluationReportDraft,
    EvaluationProvider,
    LiveRiskProvider,
    RiskAlert,
    ScenarioContext,
)


class DeterministicMockProvider(ConversationProvider, LiveRiskProvider, EvaluationProvider):
    def stream_customer_reply(
        self,
        scenario: ScenarioContext,
        messages: Sequence[ChatMessage],
        learner_turn_count: int,
    ) -> Iterable[str]:
        if scenario.customer_turns:
            index = min(learner_turn_count, len(scenario.customer_turns) - 1)
            reply = scenario.customer_turns[index]
        else:
            reply = "谢谢您的说明，请继续告诉我处理方案。"
        yield from _chunks(reply)

    def detect_risk(
        self, scenario: ScenarioContext, messages: Sequence[ChatMessage]
    ) -> RiskAlert | None:
        text = "\n".join(message.content for message in messages if message.sender == "learner")
        for risk in scenario.critical_risks:
            label = str(risk.get("label", "风险"))
            patterns = [str(item) for item in risk.get("patterns", [])]
            if any(pattern and pattern in text for pattern in patterns):
                return RiskAlert(
                    risk_label=label,
                    suggestion="请停止绝对化承诺，先核实事实并说明可执行的处理路径。",
                    severity="danger",
                )
        return None

    def evaluate(
        self, scenario: ScenarioContext, messages: Sequence[ChatMessage]
    ) -> EvaluationReportDraft:
        learner_text = "\n".join(message.content for message in messages if message.sender == "learner")
        risks = []
        for risk in scenario.critical_risks:
            label = str(risk.get("label", "风险"))
            if any(str(pattern) in learner_text for pattern in risk.get("patterns", [])):
                risks.append(label)

        dimensions: list[dict[str, object]] = []
        weighted_score = 0.0
        strengths: list[str] = []
        omissions: list[str] = []
        recommendations: list[dict[str, str]] = []
        for dimension in scenario.scoring_dimensions:
            signals = [str(signal) for signal in dimension.get("signals", [])]
            matched = [signal for signal in signals if signal in learner_text]
            score = round((len(matched) / len(signals)) * 100) if signals else 0
            weight = float(dimension.get("weight", 0))
            weighted_score += score * weight / 100
            name = str(dimension.get("name", "未命名维度"))
            evidence = [f"命中信号：{signal}" for signal in matched]
            dimensions.append({"name": name, "score": score, "max_score": 100, "evidence": evidence})
            if score >= 60:
                strengths.append(name)
            else:
                omissions.append(name)
                recommendations.append({"issue": name, "suggested_reply": str(scenario.reference_flow[0])})

        total_score = max(0, min(100, round(weighted_score)))
        low_confidence = sum(message.sender == "learner" for message in messages) < 3
        verdict = "passed" if total_score >= 80 and not risks else "needs_retry"
        return EvaluationReportDraft(
            total_score=total_score,
            verdict=verdict,
            confidence=0.92 if not low_confidence else 0.72,
            dimensions=dimensions,
            strengths=strengths,
            omissions=omissions,
            risks=risks,
            recommendations=recommendations,
            reference_reply=scenario.reference_reply,
            low_confidence=low_confidence,
        )


def _chunks(text: str, size: int = 2) -> Iterable[str]:
    for start in range(0, len(text), size):
        yield text[start : start + size]
