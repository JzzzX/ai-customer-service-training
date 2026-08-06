from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class Scenario(Base):
    __tablename__ = "scenarios"
    __table_args__ = (UniqueConstraint("scenario_key", name="uq_scenarios_scenario_key"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    scenario_key: Mapped[str] = mapped_column(String(128), index=True)
    title: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(64), index=True)
    summary: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(32), default="draft", index=True)
    created_by_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    versions: Mapped[list["ScenarioVersion"]] = relationship(
        back_populates="scenario", cascade="all, delete-orphan", order_by="ScenarioVersion.version"
    )


class ScenarioVersion(Base):
    __tablename__ = "scenario_versions"
    __table_args__ = (
        UniqueConstraint("scenario_id", "version", name="uq_scenario_versions_number"),
        UniqueConstraint("scenario_id", "version_key", name="uq_scenario_versions_key"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    scenario_id: Mapped[str] = mapped_column(ForeignKey("scenarios.id", ondelete="CASCADE"), index=True)
    version_key: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    knowledge_version_id: Mapped[str] = mapped_column(
        ForeignKey("knowledge_versions.id", ondelete="RESTRICT"), index=True
    )
    background: Mapped[str] = mapped_column(Text, default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    opening_message: Mapped[str] = mapped_column(Text, default="")
    controlled_variables: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    hidden_facts: Mapped[list[object]] = mapped_column(JSON, default=list)
    customer_turns: Mapped[list[str]] = mapped_column(JSON, default=list)
    checkpoints: Mapped[list[object]] = mapped_column(JSON, default=list)
    prohibitions: Mapped[list[str]] = mapped_column(JSON, default=list)
    scoring_weights: Mapped[dict[str, float]] = mapped_column(JSON, default=dict)
    scoring_dimensions: Mapped[list[dict[str, object]]] = mapped_column(JSON, default=list)
    critical_risks: Mapped[list[object]] = mapped_column(JSON, default=list)
    reference_flow: Mapped[list[object]] = mapped_column(JSON, default=list)
    reference_reply: Mapped[str] = mapped_column(Text, default="")
    sources: Mapped[list[dict[str, object]]] = mapped_column(JSON, default=list)
    max_turns: Mapped[int] = mapped_column(Integer, default=12)
    mock_mode: Mapped[bool] = mapped_column(Boolean, default=True)
    customer_persona: Mapped[dict[str, object] | None] = mapped_column(JSON, nullable=True)
    difficulty: Mapped[str] = mapped_column(String(32), default="medium")
    created_by_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    scenario_focus: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(32), default="draft", index=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    scenario: Mapped[Scenario] = relationship(back_populates="versions")
    sessions: Mapped[list["TrainingSession"]] = relationship(back_populates="scenario_version")


class TrainingSession(Base):
    __tablename__ = "training_sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    assignment_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    learner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    knowledge_version_id: Mapped[str] = mapped_column(
        ForeignKey("knowledge_versions.id", ondelete="RESTRICT"), index=True
    )
    scenario_version_id: Mapped[str] = mapped_column(
        ForeignKey("scenario_versions.id", ondelete="RESTRICT"), index=True
    )
    status: Mapped[str] = mapped_column(String(32), default="in_progress", index=True)
    mode: Mapped[str] = mapped_column(String(16), default="mock")
    turn_count: Mapped[int] = mapped_column(Integer, default=0)
    max_turns: Mapped[int] = mapped_column(Integer, default=12)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    learner: Mapped["User"] = relationship()
    scenario_version: Mapped[ScenarioVersion] = relationship(back_populates="sessions")
    messages: Mapped[list["TrainingMessage"]] = relationship(
        back_populates="training_session",
        cascade="all, delete-orphan",
        order_by="TrainingMessage.position",
    )
    report: Mapped["EvaluationReport | None"] = relationship(
        back_populates="training_session", uselist=False
    )
class TrainingMessage(Base):
    __tablename__ = "training_messages"
    __table_args__ = (
        UniqueConstraint("training_session_id", "position", name="uq_training_messages_position"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    training_session_id: Mapped[str] = mapped_column(
        ForeignKey("training_sessions.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column(Integer)
    sender: Mapped[str] = mapped_column(String(16))
    content: Mapped[str] = mapped_column(Text)
    metadata_json: Mapped[dict[str, object]] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    training_session: Mapped[TrainingSession] = relationship(back_populates="messages")


class EvaluationReport(Base):
    __tablename__ = "evaluation_reports"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    training_session_id: Mapped[str] = mapped_column(
        ForeignKey("training_sessions.id", ondelete="RESTRICT"), unique=True, index=True
    )
    knowledge_version_id: Mapped[str] = mapped_column(
        ForeignKey("knowledge_versions.id", ondelete="RESTRICT"), index=True
    )
    total_score: Mapped[int] = mapped_column(Integer)
    verdict: Mapped[str] = mapped_column(String(32))
    dimensions: Mapped[list[dict[str, object]]] = mapped_column(JSON, default=list)
    strengths: Mapped[list[str]] = mapped_column(JSON, default=list)
    omissions: Mapped[list[str]] = mapped_column(JSON, default=list)
    risks: Mapped[list[object]] = mapped_column(JSON, default=list)
    recommendations: Mapped[list[object]] = mapped_column(JSON, default=list)
    turn_feedback: Mapped[list[object]] = mapped_column(JSON, default=list)
    recommended_flow: Mapped[list[object]] = mapped_column(JSON, default=list)
    sample_reply: Mapped[str] = mapped_column(Text, default="")
    evidence: Mapped[list[object]] = mapped_column(JSON, default=list)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    low_confidence: Mapped[bool] = mapped_column(Boolean, default=False)
    needs_review: Mapped[bool] = mapped_column(Boolean, default=False)
    review_trigger: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    training_session: Mapped[TrainingSession] = relationship(back_populates="report")
    review_records: Mapped[list["ReviewDecision"]] = relationship(
        back_populates="report", cascade="all, delete-orphan"
    )


class ReviewDecision(Base):
    __tablename__ = "review_decisions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    report_id: Mapped[str] = mapped_column(
        ForeignKey("evaluation_reports.id", ondelete="RESTRICT"), index=True
    )
    reviewer_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    corrected_verdict: Mapped[str | None] = mapped_column(String(32), nullable=True)
    corrected_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    comment: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    report: Mapped[EvaluationReport] = relationship(back_populates="review_records")
    reviewer: Mapped["User"] = relationship()
