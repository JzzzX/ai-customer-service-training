from datetime import UTC, datetime

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    Base,
    KnowledgeSource,
    KnowledgeUnit,
    KnowledgeVersion,
    Question,
    QuizAnswer,
    QuizAttempt,
    QuizSet,
    User,
)


def make_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(dbapi_connection, _connection_record) -> None:
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    return Session(engine)


def test_phase3_models_preserve_traceability_and_attempt_snapshot() -> None:
    database = make_session()
    learner = User(
        id="learner-1",
        email="learner@example.test",
        name="测试学员",
        role="learner",
        is_active=True,
    )
    version = KnowledgeVersion(
        id="knowledge-v1",
        version_hash="a" * 64,
        label="正式知识库",
        schema_version=1,
        source_root="knowledge",
        coverage={"source_files": 1, "units_after_dedup": 1},
        status="published",
        is_active=True,
    )
    version.sources.append(
        KnowledgeSource(
            id="source-1",
            source_path="knowledge/faq.md",
            kind="markdown",
            source_hash="b" * 64,
            bytes=128,
            stats={"units_emitted": 1},
        )
    )
    unit = KnowledgeUnit(
        id="unit-1",
        unit_key="ku_001",
        title="退换货时效",
        content="签收后七天内可申请。",
        category_path=["售后"],
        semantic_key="qa:售后|退换货时效",
        content_hash="c" * 64,
        sources=[{"source_path": "knowledge/faq.md", "anchor": "h:退换货"}],
        has_conflict=False,
        can_use_for_quiz=True,
        can_use_for_scenario=True,
        can_use_for_evaluation=True,
    )
    version.units.append(unit)
    quiz_set = QuizSet(
        id="returns",
        knowledge_version=version,
        quiz_hash="d" * 64,
        label="退换货",
        description="售后政策专题",
        passing_score=80,
        status="published",
        published_at=datetime(2026, 8, 6, tzinfo=UTC),
    )
    question = Question(
        id="question-1",
        quiz_set=quiz_set,
        knowledge_unit=unit,
        prompt="退换货期限是多久？",
        question_type="single_choice",
        options=["七天", "三十天"],
        correct_answers=["七天"],
        explanation="依据售后政策。",
        category="returns",
        difficulty="easy",
        position=1,
        status="published",
    )
    attempt = QuizAttempt(
        id="attempt-1",
        learner_id=learner.id,
        quiz_set=quiz_set,
        knowledge_version=version,
        question_ids=[question.id],
        status="passed",
        correct_count=1,
        total_questions=1,
        score=100,
        completed_at=datetime(2026, 8, 6, tzinfo=UTC),
    )
    attempt.answers.append(
        QuizAnswer(
            id="answer-1",
            question=question,
            selected_answers=["七天"],
            is_correct=True,
        )
    )
    database.add_all([learner, attempt])
    database.commit()

    saved = database.get(QuizAttempt, "attempt-1")

    assert saved is not None
    assert saved.question_ids == ["question-1"]
    assert saved.answers[0].question.knowledge_unit.unit_key == "ku_001"
    assert saved.quiz_set.knowledge_version.sources[0].source_path == "knowledge/faq.md"


def test_quiz_answer_is_unique_per_attempt_and_question() -> None:
    database = make_session()
    version = KnowledgeVersion(
        id="knowledge-v1",
        version_hash="a" * 64,
        label="正式知识库",
        status="published",
        is_active=True,
    )
    quiz_set = QuizSet(
        id="returns",
        knowledge_version=version,
        quiz_hash="d" * 64,
        label="退换货",
        status="published",
    )
    question = Question(
        id="question-1",
        quiz_set=quiz_set,
        prompt="退换货期限是多久？",
        question_type="single_choice",
        options=["七天", "三十天"],
        correct_answers=["七天"],
        status="published",
    )
    learner = User(
        id="learner-1",
        email="learner@example.test",
        name="测试学员",
        role="learner",
        is_active=True,
    )
    attempt = QuizAttempt(
        id="attempt-1",
        learner_id=learner.id,
        quiz_set=quiz_set,
        knowledge_version=version,
        question_ids=[question.id],
        status="in_progress",
        total_questions=1,
    )
    attempt.answers.extend(
        [
            QuizAnswer(
                id="answer-1",
                question=question,
                selected_answers=["七天"],
                is_correct=True,
            ),
            QuizAnswer(
                id="answer-2",
                question=question,
                selected_answers=["三十天"],
                is_correct=False,
            ),
        ]
    )
    database.add_all([learner, attempt])

    with pytest.raises(IntegrityError):
        database.commit()
