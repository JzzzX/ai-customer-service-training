from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models import EvaluationReport, ScenarioVersion, TrainingSession
from app.repositories.scenario import ScenarioRepository
from app.services.scenario.ark import ArkScenarioProvider
from app.services.scenario.mock import DeterministicMockProvider
from app.services.scenario.providers import (
    ChatMessage,
    ConversationProvider,
    EvaluationProvider,
    LiveRiskProvider,
    ProviderError,
    RiskAlert,
    ScenarioContext,
)
from config.settings import Settings, get_settings


class TrainingError(RuntimeError):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        status_code: int = 409,
        retryable: bool = False,
        details: dict[str, object] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.retryable = retryable
        self.details = details


@dataclass(frozen=True)
class TrainingSendResult:
    session: TrainingSession
    customer_chunks: list[str]
    risk_alert: RiskAlert | None


class ScenarioTrainingService:
    def __init__(
        self,
        database: Session,
        *,
        conversation_provider: ConversationProvider | None = None,
        risk_provider: LiveRiskProvider | None = None,
        evaluation_provider: EvaluationProvider | None = None,
        settings: Settings | None = None,
    ) -> None:
        self.database = database
        settings = settings or get_settings()
        if conversation_provider is None or risk_provider is None or evaluation_provider is None:
            if settings.scenario_ai_mode == "ark":
                provider = ArkScenarioProvider(settings)
                conversation_provider = conversation_provider or provider
                risk_provider = risk_provider or provider
                evaluation_provider = evaluation_provider or provider
            else:
                provider = DeterministicMockProvider()
                conversation_provider = conversation_provider or provider
                risk_provider = risk_provider or provider
                evaluation_provider = evaluation_provider or provider
        self.conversation_provider = conversation_provider
        self.risk_provider = risk_provider
        self.evaluation_provider = evaluation_provider

    def start(self, learner_id: str, scenario_id: str) -> TrainingSession:
        repository = ScenarioRepository(self.database)
        version = repository.get_published_version(scenario_id)
        if version is None:
            raise TrainingError("SCENARIO_NOT_FOUND", "实战场景不存在或尚未发布。", status_code=404)
        mode = "real" if isinstance(self.conversation_provider, ArkScenarioProvider) else "mock"
        session = repository.create_session(learner_id=learner_id, version=version, mode=mode)
        self.database.flush()
        return session

    def load(self, learner_id: str, session_id: str) -> TrainingSession:
        session = ScenarioRepository(self.database).get_owned_session(session_id, learner_id)
        if session is None:
            raise TrainingError("SCENARIO_SESSION_NOT_FOUND", "实战会话不存在。", status_code=404)
        return session

    def send_message(
        self,
        learner_id: str,
        session_id: str,
        content: str,
        *,
        expected_turn_count: int,
    ) -> TrainingSendResult:
        content = content.strip()
        if not content:
            raise TrainingError("SCENARIO_MESSAGE_INVALID", "消息内容不能为空。", status_code=422)
        session = self.load(learner_id, session_id)
        if session.status != "in_progress":
            raise TrainingError("SCENARIO_SESSION_COMPLETED", "实战会话已经完成。")
        if expected_turn_count != session.turn_count:
            raise TrainingError(
                "SCENARIO_STALE_TURN",
                "会话进度已经变化，请刷新后重试。",
                details={"expected_turn_count": expected_turn_count, "actual_turn_count": session.turn_count},
            )
        context = _context_from_version(session.scenario_version)
        previous_messages = [
            ChatMessage(sender=message.sender, content=message.content)
            for message in session.messages
        ]
        candidate_messages = [*previous_messages, ChatMessage(sender="learner", content=content)]
        try:
            chunks = list(
                self.conversation_provider.stream_customer_reply(
                    context, candidate_messages, session.turn_count
                )
            )
            if not chunks or not "".join(chunks).strip():
                raise ProviderError("SCENARIO_AI_EMPTY_RESPONSE", "顾客回复为空。", retryable=True)
        except ProviderError as error:
            session.last_error = error.code
            session.updated_at = datetime.now(UTC)
            self.database.flush()
            raise TrainingError(
                error.code,
                error.message,
                retryable=error.retryable,
                details=error.details,
            ) from error

        risk_alert: RiskAlert | None = None
        try:
            risk_alert = self.risk_provider.detect_risk(context, candidate_messages)
        except ProviderError:
            risk_alert = None
        turn = session.turn_count + 1
        risk_metadata = asdict(risk_alert) if risk_alert else {}
        ScenarioRepository(self.database).append_messages(
            session,
            [
                ("learner", content, {"turn": turn}),
                ("customer", "".join(chunks), {"turn": turn, "risk_alert": risk_metadata}),
            ],
            turn_count=turn,
        )
        session.last_error = None
        self.database.flush()
        return TrainingSendResult(session=session, customer_chunks=chunks, risk_alert=risk_alert)

    def complete(self, learner_id: str, session_id: str) -> TrainingSession:
        session = self.load(learner_id, session_id)
        if session.report is not None:
            return session
        if session.status != "in_progress":
            raise TrainingError("SCENARIO_REPORT_NOT_AVAILABLE", "会话报告尚未生成。", retryable=True)
        draft = self._evaluate(session)
        self._save_report(session, draft)
        self.database.flush()
        return session

    def retry_report(self, learner_id: str, session_id: str) -> TrainingSession:
        return self.complete(learner_id, session_id)

    def complete_stream(self, learner_id: str, session_id: str) -> Iterable[dict[str, object]]:
        session = self.load(learner_id, session_id)
        if session.report is not None:
            yield {"event": "report", "report": _report_payload(session.report)}
            return
        if session.status != "in_progress":
            raise TrainingError("SCENARIO_REPORT_NOT_AVAILABLE", "会话报告尚未生成。", retryable=True)
        yield {"event": "analyzing", "message": "正在分析训练对话。"}
        yield {"event": "scoring", "message": "正在计算训练评分。"}
        draft = self._evaluate(session)
        yield {"event": "saving", "message": "正在保存训练报告。"}
        self._save_report(session, draft)
        self.database.flush()
        yield {"event": "report", "report": _report_payload(session.report)}

    def _evaluate(self, session: TrainingSession):
        context = _context_from_version(session.scenario_version)
        messages = [ChatMessage(sender=item.sender, content=item.content) for item in session.messages]
        try:
            return self.evaluation_provider.evaluate(context, messages)
        except ProviderError as error:
            session.last_error = error.code
            session.updated_at = datetime.now(UTC)
            self.database.flush()
            raise TrainingError(
                "SCENARIO_REPORT_FAILED",
                "训练报告生成失败，请重试。",
                retryable=error.retryable,
                details={"provider_code": error.code},
            ) from error

    def _save_report(self, session: TrainingSession, draft) -> EvaluationReport:
        if session.report is not None:
            return session.report
        report = EvaluationReport(
            id=f"report_{uuid4().hex}",
            training_session_id=session.id,
            knowledge_version_id=session.knowledge_version_id,
            total_score=draft.total_score,
            verdict=draft.verdict,
            dimensions=draft.dimensions,
            strengths=draft.strengths,
            omissions=draft.omissions,
            risks=draft.risks,
            recommendations=draft.recommendations,
            recommended_flow=list(session.scenario_version.reference_flow),
            sample_reply=draft.reference_reply,
            evidence=[],
            confidence=draft.confidence,
            low_confidence=draft.low_confidence,
            needs_review=draft.low_confidence or draft.verdict != "passed",
            review_trigger="low_confidence" if draft.low_confidence else None,
        )
        session.report = report
        session.status = "completed"
        session.completed_at = datetime.now(UTC)
        session.updated_at = datetime.now(UTC)
        session.last_error = None
        self.database.add(report)
        return report


def _context_from_version(version: ScenarioVersion) -> ScenarioContext:
    return ScenarioContext(
        id=version.id,
        title=version.scenario.title,
        summary=version.summary,
        opening_message=version.opening_message,
        customer_turns=list(version.customer_turns or []),
        scoring_dimensions=list(version.scoring_dimensions or []),
        critical_risks=list(version.critical_risks or []),
        reference_flow=list(version.reference_flow or []),
        reference_reply=version.reference_reply,
        max_turns=version.max_turns,
    )


def _report_payload(report: EvaluationReport | None) -> dict[str, object]:
    if report is None:
        return {}
    return {
        "id": report.id,
        "total_score": report.total_score,
        "verdict": report.verdict,
        "dimensions": report.dimensions,
        "strengths": report.strengths,
        "omissions": report.omissions,
        "risks": report.risks,
        "recommendations": report.recommendations,
        "reference_reply": report.sample_reply,
        "confidence": report.confidence,
        "low_confidence": report.low_confidence,
    }


__all__ = ["ScenarioTrainingService", "TrainingError", "TrainingSendResult"]
