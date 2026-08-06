from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class AdminPageResponse(BaseModel):
    items: list[dict[str, Any]]
    total: int
    next_offset: int | None = None


class AdminOverviewResponse(BaseModel):
    counts: dict[str, int]


class ReviewDecisionRequest(BaseModel):
    status: Literal["approved", "rejected"]
    corrected_verdict: str | None = Field(default=None, max_length=32)
    corrected_score: int | None = Field(default=None, ge=0, le=100)
    comment: str = Field(default="", max_length=2000)


class ReviewDecisionResponse(BaseModel):
    id: str
    report_id: str
    reviewer_id: str
    status: str
    corrected_verdict: str | None
    corrected_score: int | None
    comment: str
    created_at: datetime


class AssignmentCreateRequest(BaseModel):
    learner_id: str = Field(min_length=1, max_length=64)
    assignment_type: Literal["quiz", "scenario"]
    target_id: str = Field(min_length=1, max_length=64)
    due_at: datetime | None = None


class QuestionReviewUpdateRequest(BaseModel):
    status: Literal["approved", "rejected"]
    prompt: str | None = Field(default=None, min_length=1, max_length=10000)
    options: list[str] | None = Field(default=None, min_length=2)
    correct_answers: list[str] | None = Field(default=None, min_length=1)
    explanation: str | None = Field(default=None, max_length=10000)
    category: str | None = Field(default=None, max_length=128)
    difficulty: Literal["easy", "medium", "hard"] | None = None
    comment: str = Field(default="", max_length=2000)


class PublishQuizSetResponse(BaseModel):
    id: str
    status: str
    question_count: int


class AdminReviewDetailResponse(BaseModel):
    report: dict[str, Any]
    messages: list[dict[str, Any]]
    decisions: list[dict[str, Any]]


class ScenarioDraftGenerateRequest(BaseModel):
    category: Literal["presale", "logistics", "damage_shortage", "complaint"]
    count: int = Field(default=3, ge=1, le=5)


class ScenarioDraftGenerateResponse(BaseModel):
    scenarios: list[dict[str, Any]]


class AdminQuestionDetailResponse(BaseModel):
    id: str
    quiz_set_id: str | None = None
    prompt: str
    options: list[str]
    correct_answers: list[str]
    explanation: str
    category: str
    difficulty: str
    status: str
    latest_review: dict[str, Any] | None = None
