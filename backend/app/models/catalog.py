from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


quiz_set_questions = Table(
    "quiz_set_questions",
    Base.metadata,
    Column("quiz_set_id", String(64), ForeignKey("quiz_sets.id", ondelete="CASCADE"), primary_key=True),
    Column("question_id", String(64), ForeignKey("questions.id", ondelete="RESTRICT"), primary_key=True),
    Column("position", Integer, nullable=False, default=0),
    Column("points", Integer, nullable=False, default=1),
)


class KnowledgeVersion(Base):
    __tablename__ = "knowledge_versions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    version_hash: Mapped[str | None] = mapped_column(
        String(64), unique=True, index=True, nullable=True
    )
    label: Mapped[str] = mapped_column(String(255))
    schema_version: Mapped[int] = mapped_column(Integer, default=1)
    source_root: Mapped[str] = mapped_column(String(1024), default="")
    coverage: Mapped[dict[str, int]] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(32), default="draft", index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    quiz_sets: Mapped[list["QuizSet"]] = relationship(
        back_populates="knowledge_version", cascade="all, delete-orphan"
    )
    sources: Mapped[list["KnowledgeSource"]] = relationship(
        back_populates="knowledge_version", cascade="all, delete-orphan"
    )
    units: Mapped[list["KnowledgeUnit"]] = relationship(
        back_populates="knowledge_version", cascade="all, delete-orphan"
    )


class KnowledgeSource(Base):
    __tablename__ = "knowledge_sources"
    __table_args__ = (
        UniqueConstraint(
            "knowledge_version_id",
            "source_path",
            name="uq_knowledge_sources_version_path",
        ),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    knowledge_version_id: Mapped[str] = mapped_column(
        ForeignKey("knowledge_versions.id", ondelete="CASCADE"), index=True
    )
    source_path: Mapped[str] = mapped_column(String(1024))
    kind: Mapped[str] = mapped_column(String(32))
    source_hash: Mapped[str] = mapped_column(String(64))
    bytes: Mapped[int] = mapped_column(Integer)
    stats: Mapped[dict[str, int]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    knowledge_version: Mapped[KnowledgeVersion] = relationship(
        back_populates="sources"
    )


class KnowledgeUnit(Base):
    __tablename__ = "knowledge_units"
    __table_args__ = (
        UniqueConstraint(
            "knowledge_version_id",
            "unit_key",
            name="uq_knowledge_units_version_key",
        ),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    knowledge_version_id: Mapped[str] = mapped_column(
        ForeignKey("knowledge_versions.id", ondelete="CASCADE"), index=True
    )
    unit_key: Mapped[str] = mapped_column(String(64))
    title: Mapped[str] = mapped_column(String(512))
    content: Mapped[str] = mapped_column(Text)
    category_path: Mapped[list[str]] = mapped_column(JSON, default=list)
    semantic_key: Mapped[str | None] = mapped_column(
        String(1024), nullable=True, index=True
    )
    content_hash: Mapped[str] = mapped_column(String(64), index=True)
    sources: Mapped[list[dict[str, object]]] = mapped_column(JSON, default=list)
    has_conflict: Mapped[bool] = mapped_column(Boolean, default=False)
    can_use_for_quiz: Mapped[bool] = mapped_column(Boolean, default=True)
    can_use_for_scenario: Mapped[bool] = mapped_column(Boolean, default=True)
    can_use_for_evaluation: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    knowledge_version: Mapped[KnowledgeVersion] = relationship(
        back_populates="units"
    )
    questions: Mapped[list["Question"]] = relationship(
        back_populates="knowledge_unit"
    )


class QuizSet(Base):
    __tablename__ = "quiz_sets"
    __table_args__ = (
        UniqueConstraint(
            "knowledge_version_id",
            "topic_key",
            name="uq_quiz_sets_version_topic",
        ),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    knowledge_version_id: Mapped[str] = mapped_column(
        ForeignKey("knowledge_versions.id", ondelete="RESTRICT"), index=True
    )
    topic_key: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )
    label: Mapped[str] = mapped_column(String(255))
    quiz_hash: Mapped[str | None] = mapped_column(
        String(64), unique=True, index=True, nullable=True
    )
    source_quiz_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_by_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    description: Mapped[str] = mapped_column(Text, default="")
    passing_score: Mapped[int] = mapped_column(Integer, default=80)
    status: Mapped[str] = mapped_column(String(32), default="draft", index=True)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    knowledge_version: Mapped[KnowledgeVersion] = relationship(
        back_populates="quiz_sets"
    )
    questions: Mapped[list["Question"]] = relationship(
        secondary=quiz_set_questions,
        back_populates="quiz_sets",
        order_by=quiz_set_questions.c.position,
    )
    attempts: Mapped[list["QuizAttempt"]] = relationship(back_populates="quiz_set")


class Question(Base):
    __tablename__ = "questions"
    __table_args__ = (
        UniqueConstraint(
            "quiz_set_id",
            "question_key",
            name="uq_questions_set_key",
        ),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    quiz_set_id: Mapped[str | None] = mapped_column(
        ForeignKey("quiz_sets.id", ondelete="CASCADE"), index=True
    )
    knowledge_version_id: Mapped[str | None] = mapped_column(
        ForeignKey("knowledge_versions.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    created_by_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    question_key: Mapped[str | None] = mapped_column(
        String(128), nullable=True, index=True
    )
    knowledge_unit_id: Mapped[str | None] = mapped_column(
        ForeignKey("knowledge_units.id", ondelete="RESTRICT"),
        index=True,
        nullable=True,
    )
    prompt: Mapped[str] = mapped_column(Text)
    question_type: Mapped[str] = mapped_column(String(32))
    options: Mapped[list[str]] = mapped_column(JSON)
    correct_answers: Mapped[list[str]] = mapped_column(JSON)
    explanation: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(128), default="")
    difficulty: Mapped[str] = mapped_column(String(32), default="easy")
    position: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(32), default="draft", index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    quiz_sets: Mapped[list[QuizSet]] = relationship(
        secondary=quiz_set_questions,
        back_populates="questions",
        overlaps="quiz_set",
    )
    quiz_set: Mapped[QuizSet | None] = relationship(
        foreign_keys=[quiz_set_id],
        overlaps="quiz_sets,questions",
    )
    knowledge_unit: Mapped[KnowledgeUnit | None] = relationship(
        back_populates="questions"
    )
    answers: Mapped[list["QuizAnswer"]] = relationship(back_populates="question")
    reviews: Mapped[list["QuestionReview"]] = relationship(
        back_populates="question", cascade="all, delete-orphan"
    )


class QuestionReview(Base):
    __tablename__ = "question_reviews"
    __table_args__ = (
        UniqueConstraint(
            "question_id",
            "content_hash",
            name="uq_question_reviews_question_hash",
        ),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    question_id: Mapped[str] = mapped_column(
        ForeignKey("questions.id", ondelete="RESTRICT"), index=True
    )
    reviewer_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    content_hash: Mapped[str] = mapped_column(String(64))
    snapshot: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    question: Mapped[Question] = relationship(back_populates="reviews")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    assignment_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    learner_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    quiz_set_id: Mapped[str] = mapped_column(
        ForeignKey("quiz_sets.id", ondelete="RESTRICT"), index=True
    )
    knowledge_version_id: Mapped[str] = mapped_column(
        ForeignKey("knowledge_versions.id", ondelete="RESTRICT"), index=True
    )
    question_ids: Mapped[list[str]] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(32), default="in_progress", index=True)
    origin: Mapped[str] = mapped_column(String(32), default="quiz")
    correct_count: Mapped[int] = mapped_column(Integer, default=0)
    total_questions: Mapped[int] = mapped_column(Integer)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    quiz_set: Mapped[QuizSet] = relationship(back_populates="attempts")
    knowledge_version: Mapped[KnowledgeVersion] = relationship()
    answers: Mapped[list["QuizAnswer"]] = relationship(
        back_populates="attempt", cascade="all, delete-orphan"
    )


class QuizAnswer(Base):
    __tablename__ = "quiz_answers"
    __table_args__ = (
        UniqueConstraint(
            "quiz_attempt_id",
            "question_id",
            name="uq_quiz_answers_attempt_question",
        ),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    quiz_attempt_id: Mapped[str] = mapped_column(
        ForeignKey("quiz_attempts.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[str] = mapped_column(
        ForeignKey("questions.id", ondelete="RESTRICT"), index=True
    )
    source_question_key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    selected_answers: Mapped[list[str]] = mapped_column(JSON)
    is_correct: Mapped[bool] = mapped_column(Boolean)
    answered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    attempt: Mapped[QuizAttempt] = relationship(back_populates="answers")
    question: Mapped[Question] = relationship(back_populates="answers")
