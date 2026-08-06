from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class ScenarioCatalogItemResponse(BaseModel):
    id: str
    scenario_version_id: str
    title: str
    category: str
    summary: str
    opening_message: str
    difficulty: str
    max_turns: int
    mock_mode: bool


class ScenarioCatalogResponse(BaseModel):
    items: list[ScenarioCatalogItemResponse]


class ScenarioMessageResponse(BaseModel):
    id: str
    position: int
    sender: Literal["customer", "learner"]
    content: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class ScenarioRiskResponse(BaseModel):
    risk_label: str
    suggestion: str
    severity: str


class ScenarioReportResponse(BaseModel):
    id: str
    total_score: int
    verdict: str
    dimensions: list[dict[str, Any]]
    strengths: list[str]
    omissions: list[str]
    risks: list[Any]
    recommendations: list[Any]
    reference_reply: str
    confidence: float
    low_confidence: bool


class ScenarioSessionResponse(BaseModel):
    id: str
    learner_id: str
    scenario_id: str
    scenario_version_id: str
    title: str
    category: str
    status: Literal["active", "completed"]
    mode: Literal["mock", "real"]
    turn_count: int
    max_turns: int
    messages: list[ScenarioMessageResponse]
    report: ScenarioReportResponse | None = None
    started_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None


class ScenarioStartResponse(ScenarioSessionResponse):
    pass


class ScenarioMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    expected_turn_count: int = Field(ge=0)


class ScenarioMessageSendResponse(BaseModel):
    session: ScenarioSessionResponse
    customer_chunks: list[str]
    risk_alert: ScenarioRiskResponse | None = None


class ScenarioHistorySessionResponse(BaseModel):
    id: str
    scenario_id: str
    title: str
    category: str
    status: Literal["active", "completed"]
    mode: Literal["mock", "real"]
    turn_count: int
    max_turns: int
    started_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None
    score: int | None = None
    verdict: str | None = None


class ScenarioHistoryGroupResponse(BaseModel):
    scenario_id: str
    scenario_key: str
    title: str
    category: str
    total_session_count: int
    active_session_count: int
    completed_session_count: int
    latest_activity_at: datetime
    latest_session: ScenarioHistorySessionResponse


class ScenarioHistoryResponse(BaseModel):
    groups: list[ScenarioHistoryGroupResponse]
    next_cursor: str | None = None


class ScenarioHistorySessionsResponse(BaseModel):
    items: list[ScenarioHistorySessionResponse]
    next_cursor: str | None = None
