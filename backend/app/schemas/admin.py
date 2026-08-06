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
