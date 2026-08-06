from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.schemas.auth import CurrentUserResponse


class AssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    assignment_type: str
    target_id: str
    target_label: str
    status: str
    due_at: datetime | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime


class KnowledgeProgressResponse(BaseModel):
    total_questions: int
    unique_answered_count: int
    total_correct_answers: int
    total_answered_answers: int
    accuracy: int
    attempt_count: int


class ScenarioProgressResponse(BaseModel):
    published_scenario_count: int
    completed_scenario_count: int
    completed_session_count: int
    recent_average_score: int


class LearnerOverviewResponse(BaseModel):
    user: CurrentUserResponse
    assignments: list[AssignmentResponse]
    knowledge: KnowledgeProgressResponse
    scenario: ScenarioProgressResponse


class AssignmentPageResponse(BaseModel):
    items: list[AssignmentResponse]
    total: int
    next_offset: int | None = None
