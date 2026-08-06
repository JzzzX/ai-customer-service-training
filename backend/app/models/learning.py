from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    learner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    assigned_by_id: Mapped[str] = mapped_column(String(36))
    assignment_type: Mapped[str] = mapped_column(String(32))
    target_id: Mapped[str] = mapped_column(String(36))
    target_label: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(32), default="assigned")
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class KnowledgeProgress(Base):
    __tablename__ = "knowledge_progress"

    learner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    total_questions: Mapped[int] = mapped_column(Integer, default=0)
    unique_answered_count: Mapped[int] = mapped_column(Integer, default=0)
    total_correct_answers: Mapped[int] = mapped_column(Integer, default=0)
    total_answered_answers: Mapped[int] = mapped_column(Integer, default=0)
    accuracy: Mapped[int] = mapped_column(Integer, default=0)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ScenarioProgressSummary(Base):
    __tablename__ = "scenario_progress_summaries"

    learner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    published_scenario_count: Mapped[int] = mapped_column(Integer, default=0)
    completed_scenario_count: Mapped[int] = mapped_column(Integer, default=0)
    completed_session_count: Mapped[int] = mapped_column(Integer, default=0)
    recent_average_score: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
