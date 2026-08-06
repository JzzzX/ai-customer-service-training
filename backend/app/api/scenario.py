from __future__ import annotations

from collections.abc import Iterator
import json

from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_session
from app.core.errors import AppError
from app.models import ScenarioVersion, TrainingSession, User
from app.repositories.scenario import ScenarioRepository
from app.schemas.scenario import (
    ScenarioCatalogItemResponse,
    ScenarioCatalogResponse,
    ScenarioHistoryGroupResponse,
    ScenarioHistoryResponse,
    ScenarioHistorySessionResponse,
    ScenarioHistorySessionsResponse,
    ScenarioMessageRequest,
    ScenarioMessageResponse,
    ScenarioMessageSendResponse,
    ScenarioReportResponse,
    ScenarioRiskResponse,
    ScenarioSessionResponse,
)
from app.services.scenario.providers import RiskAlert
from app.services.scenario.training import ScenarioTrainingService, TrainingError


router = APIRouter(tags=["scenario training"])


@router.get("/scenarios", response_model=ScenarioCatalogResponse)
def list_scenarios(
    _user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ScenarioCatalogResponse:
    items = []
    for version in ScenarioRepository(session).list_published():
        items.append(
            ScenarioCatalogItemResponse(
                id=version.scenario.id,
                scenario_version_id=version.id,
                title=version.scenario.title,
                category=version.scenario.category,
                summary=version.summary,
                opening_message=version.opening_message,
                difficulty=version.difficulty,
                max_turns=version.max_turns,
                mock_mode=version.mock_mode,
            )
        )
    return ScenarioCatalogResponse(items=items)


@router.post(
    "/scenarios/{scenario_id}/sessions",
    response_model=ScenarioSessionResponse,
    status_code=201,
)
def start_scenario_session(
    scenario_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ScenarioSessionResponse:
    try:
        training = ScenarioTrainingService(session)
        created = training.start(user.id, scenario_id)
    except TrainingError as error:
        raise _as_app_error(error) from error
    return _session_response(created)


@router.get(
    "/scenario-sessions/{session_id}",
    response_model=ScenarioSessionResponse,
)
def get_scenario_session(
    session_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ScenarioSessionResponse:
    try:
        loaded = ScenarioTrainingService(session).load(user.id, session_id)
    except TrainingError as error:
        raise _as_app_error(error) from error
    return _session_response(loaded)


@router.post(
    "/scenario-sessions/{session_id}/messages",
    response_model=ScenarioMessageSendResponse,
)
def send_scenario_message(
    session_id: str,
    payload: ScenarioMessageRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ScenarioMessageSendResponse:
    try:
        result = ScenarioTrainingService(session).send_message(
            user.id,
            session_id,
            payload.content,
            expected_turn_count=payload.expected_turn_count,
        )
    except TrainingError as error:
        raise _as_app_error(error) from error
    return ScenarioMessageSendResponse(
        session=_session_response(result.session),
        customer_chunks=result.customer_chunks,
        risk_alert=_risk_response(result.risk_alert),
    )


@router.post("/scenario-sessions/{session_id}/report/stream")
def stream_scenario_report(
    session_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> StreamingResponse:
    service = ScenarioTrainingService(session)

    def events() -> Iterator[str]:
        try:
            for event in service.complete_stream(user.id, session_id):
                if event["event"] == "report":
                    # Streaming dependencies keep their SQLAlchemy session open until
                    # the body is consumed; commit before yielding the terminal event
                    # so a client retry cannot be blocked by SQLite/MySQL row locks.
                    session.commit()
                yield _sse_event(str(event["event"]), event)
        except TrainingError as error:
            yield _sse_event(
                "error",
                {
                    "code": error.code,
                    "message": error.message,
                    "retryable": error.retryable,
                    "details": error.details,
                },
            )

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post(
    "/scenario-sessions/{session_id}/report/retry",
    response_model=ScenarioSessionResponse,
)
def retry_scenario_report(
    session_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ScenarioSessionResponse:
    try:
        completed = ScenarioTrainingService(session).retry_report(user.id, session_id)
    except TrainingError as error:
        raise _as_app_error(error) from error
    return _session_response(completed)


@router.get("/me/scenario-history", response_model=ScenarioHistoryResponse)
def get_scenario_history(
    status: str = Query("all", pattern="^(all|active|completed)$"),
    cursor: str | None = None,
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ScenarioHistoryResponse:
    groups, next_cursor = ScenarioRepository(session).list_history_groups_page(
        user.id, status=status, cursor=cursor, limit=limit
    )
    return ScenarioHistoryResponse(
        groups=[_history_group_response(group) for group in groups],
        next_cursor=next_cursor,
    )


@router.get(
    "/me/scenario-history/{scenario_id}/sessions",
    response_model=ScenarioHistorySessionsResponse,
)
def get_scenario_history_sessions(
    scenario_id: str,
    status: str = Query("all", pattern="^(all|active|completed)$"),
    cursor: str | None = None,
    limit: int = Query(10, ge=1, le=100),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ScenarioHistorySessionsResponse:
    items, next_cursor = ScenarioRepository(session).list_history_sessions(
        user.id, scenario_id, status=status, cursor=cursor, limit=limit
    )
    return ScenarioHistorySessionsResponse(
        items=[_history_session_response(item) for item in items],
        next_cursor=next_cursor,
    )


def _session_response(session: TrainingSession) -> ScenarioSessionResponse:
    version = session.scenario_version
    return ScenarioSessionResponse(
        id=session.id,
        learner_id=session.learner_id,
        scenario_id=version.scenario.id,
        scenario_version_id=version.id,
        title=version.scenario.title,
        category=version.scenario.category,
        status="active" if session.status == "in_progress" else "completed",
        mode=session.mode,
        turn_count=session.turn_count,
        max_turns=session.max_turns,
        messages=[
            ScenarioMessageResponse(
                id=message.id,
                position=message.position,
                sender=message.sender,
                content=message.content,
                metadata=message.metadata_json or {},
                created_at=message.created_at,
            )
            for message in session.messages
        ],
        report=_report_response(session.report),
        started_at=session.started_at,
        updated_at=session.updated_at,
        completed_at=session.completed_at,
    )


def _report_response(report) -> ScenarioReportResponse | None:
    if report is None:
        return None
    return ScenarioReportResponse(
        id=report.id,
        total_score=report.total_score,
        verdict=report.verdict,
        dimensions=report.dimensions,
        strengths=report.strengths,
        omissions=report.omissions,
        risks=report.risks,
        recommendations=report.recommendations,
        reference_reply=report.sample_reply,
        confidence=report.confidence,
        low_confidence=report.low_confidence,
    )


def _risk_response(alert: RiskAlert | None) -> ScenarioRiskResponse | None:
    if alert is None:
        return None
    return ScenarioRiskResponse(
        risk_label=alert.risk_label,
        suggestion=alert.suggestion,
        severity=alert.severity,
    )


def _history_group_response(group: dict[str, object]) -> ScenarioHistoryGroupResponse:
    latest = group["latest_session"]
    return ScenarioHistoryGroupResponse(
        scenario_id=str(group["scenario_id"]),
        scenario_key=str(group["scenario_key"]),
        title=str(group["title"]),
        category=str(group["category"]),
        total_session_count=int(group["total_session_count"]),
        active_session_count=int(group["active_session_count"]),
        completed_session_count=int(group["completed_session_count"]),
        latest_activity_at=group["latest_activity_at"],
        latest_session=_history_session_response(latest),
    )


def _history_session_response(session: TrainingSession) -> ScenarioHistorySessionResponse:
    version = session.scenario_version
    return ScenarioHistorySessionResponse(
        id=session.id,
        scenario_id=version.scenario.id,
        title=version.scenario.title,
        category=version.scenario.category,
        status="active" if session.status == "in_progress" else "completed",
        mode=session.mode,
        turn_count=session.turn_count,
        max_turns=session.max_turns,
        started_at=session.started_at,
        updated_at=session.updated_at,
        completed_at=session.completed_at,
        score=session.report.total_score if session.report else None,
        verdict=session.report.verdict if session.report else None,
    )


def _sse_event(event: str, payload: dict[str, object]) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False, default=str)}\n\n"


def _as_app_error(error: TrainingError) -> AppError:
    details: dict[str, object] = {"retryable": error.retryable}
    if error.details:
        details.update(error.details)
    return AppError(
        code=error.code,
        message=error.message,
        status_code=error.status_code,
        details=details,
    )
