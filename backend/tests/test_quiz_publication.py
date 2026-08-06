import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, KnowledgeUnit, KnowledgeVersion, Question, QuizSet
from app.services.quiz.publication import (
    QuizPublicationInput,
    QuizPublicationService,
)


def make_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def seed_knowledge(database: Session) -> KnowledgeVersion:
    version = KnowledgeVersion(
        id="knowledge-v1",
        version_hash="a" * 64,
        label="正式知识库",
        status="published",
        is_active=True,
    )
    version.units = [
        KnowledgeUnit(
            id="unit-good",
            unit_key="ku_good",
            title="退换货时效",
            content="七天",
            category_path=["售后"],
            content_hash="b" * 64,
            sources=[{"source_path": "faq.md", "anchor": "h:售后"}],
            has_conflict=False,
            can_use_for_quiz=True,
        ),
        KnowledgeUnit(
            id="unit-conflict",
            unit_key="ku_conflict",
            title="冲突知识",
            content="不一致",
            category_path=["售后"],
            content_hash="c" * 64,
            sources=[{"source_path": "faq.xlsx", "anchor": "row:2"}],
            has_conflict=True,
            can_use_for_quiz=False,
        ),
    ]
    database.add(version)
    database.commit()
    return version


def payload(*, unit_key: str = "ku_good", topic_id: str = "returns"):
    return QuizPublicationInput.model_validate(
        {
            "schema_version": 1,
            "knowledge_version_hash": "a" * 64,
            "topics": [
                {
                    "id": topic_id,
                    "label": "退换货",
                    "description": "售后政策专题",
                    "passing_score": 80,
                    "quiz_hash": "d" * 64,
                    "questions": [
                        {
                            "id": "legacy-question-1",
                            "knowledge_unit_key": unit_key,
                            "question_type": "single_choice",
                            "prompt": "退换货期限是多久？",
                            "options": ["七天", "三十天"],
                            "correct_answers": ["七天"],
                            "explanation": "依据售后政策。",
                            "category": "returns",
                            "difficulty": "easy",
                            "position": 1,
                        }
                    ],
                }
            ],
        }
    )


def test_quiz_publication_persists_answers_and_is_idempotent() -> None:
    database = make_session()
    seed_knowledge(database)
    service = QuizPublicationService(database)

    first = service.publish(payload())
    database.commit()
    repeated = service.publish(payload())
    database.commit()

    stored_set = database.query(QuizSet).one()
    stored_question = database.query(Question).one()
    assert first.created_topic_count == 1
    assert repeated.created_topic_count == 0
    assert stored_set.topic_key == "returns"
    assert stored_set.status == "published"
    assert stored_question.question_key == "legacy-question-1"
    assert stored_question.correct_answers == ["七天"]
    assert stored_question.knowledge_unit_id == "unit-good"


def test_quiz_publication_rejects_conflicting_knowledge() -> None:
    database = make_session()
    seed_knowledge(database)

    with pytest.raises(ValueError, match="conflicting knowledge"):
        QuizPublicationService(database).publish(payload(unit_key="ku_conflict"))

    assert database.query(QuizSet).count() == 0


def test_quiz_publication_rolls_back_all_topics_when_one_is_invalid() -> None:
    database = make_session()
    seed_knowledge(database)
    publication = payload()
    invalid_topic = publication.topics[0].model_copy(
        update={
            "id": "invalid",
            "quiz_hash": "e" * 64,
            "questions": [
                publication.topics[0].questions[0].model_copy(
                    update={"knowledge_unit_key": "missing-unit"}
                )
            ],
        }
    )
    publication = publication.model_copy(
        update={"topics": [publication.topics[0], invalid_topic]}
    )

    with pytest.raises(ValueError, match="missing knowledge unit"):
        QuizPublicationService(database).publish(publication)
    database.rollback()

    assert database.query(QuizSet).count() == 0
