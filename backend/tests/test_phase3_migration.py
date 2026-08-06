import copy

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, KnowledgeUnit, KnowledgeVersion, Question, QuizSet
from app.services.phase3_migration import (
    migrate_phase3_export,
    reconcile_phase3_export,
)
from app.services.quiz.publication import canonical_quiz_hash


def make_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def make_export() -> dict[str, object]:
    topics = [
        {
            "id": "returns",
            "label": "退换货",
            "description": "售后政策",
            "passing_score": 80,
            "quiz_hash": "b" * 64,
            "questions": [
                {
                    "id": "qq_returns_1",
                    "knowledge_unit_key": "ku_returns_1",
                    "question_type": "single_choice",
                    "prompt": "退换货期限是多久？",
                    "options": ["七天", "三十天"],
                    "correct_answers": ["七天"],
                    "explanation": "依据售后政策。",
                    "category": "returns",
                    "difficulty": "easy",
                    "position": 1,
                    "sources": [
                        {
                            "source_path": "faq.md",
                            "kind": "markdown",
                            "anchor": "h:退换货",
                            "path": ["售后", "退换货"],
                        }
                    ],
                }
            ],
        },
        {
            "id": "shipping",
            "label": "物流",
            "description": "物流政策",
            "passing_score": 80,
            "quiz_hash": "c" * 64,
            "questions": [
                {
                    "id": "qq_shipping_1",
                    "knowledge_unit_key": "ku_shipping_1",
                    "question_type": "true_false",
                    "prompt": "发货前可以修改地址吗？",
                    "options": ["正确", "错误"],
                    "correct_answers": ["正确"],
                    "explanation": "联系客服处理。",
                    "category": "shipping",
                    "difficulty": "medium",
                    "position": 1,
                    "sources": [
                        {
                            "source_path": "faq.xlsx",
                            "kind": "excel",
                            "anchor": "sheet:物流!A2",
                            "path": ["物流"],
                        }
                    ],
                }
            ],
        },
    ]
    base = {
        "schema_version": 1,
        "knowledge_version_hash": "a" * 64,
        "topics": topics,
    }
    return {**base, "export_hash": canonical_quiz_hash(base)}


def test_migration_is_idempotent_and_reconciles_source_counts() -> None:
    database = make_session()
    payload = make_export()

    first = migrate_phase3_export(database, payload)
    database.commit()
    repeated = migrate_phase3_export(database, payload)
    database.commit()
    report = reconcile_phase3_export(database, payload)

    assert first.created_topic_count == 2
    assert repeated.created_topic_count == 0
    assert report.passed is True
    assert report.source_topic_count == report.imported_topic_count == 2
    assert report.source_question_count == report.imported_question_count == 2
    assert report.source_hash == report.target_hash
    assert database.query(KnowledgeVersion).count() == 1
    assert database.query(KnowledgeUnit).count() == 2
    assert database.query(QuizSet).count() == 2
    assert database.query(Question).count() == 2


def test_two_fresh_rehearsals_produce_the_same_target_hash() -> None:
    payload = make_export()
    hashes = []
    for _ in range(2):
        database = make_session()
        migrate_phase3_export(database, copy.deepcopy(payload))
        database.commit()
        hashes.append(reconcile_phase3_export(database, payload).target_hash)
    assert hashes[0] == hashes[1]


def test_malformed_export_is_rejected_without_writing() -> None:
    database = make_session()
    payload = make_export()
    payload["topics"][0]["questions"][0]["sources"] = []

    with pytest.raises(ValueError, match="sources"):
        migrate_phase3_export(database, payload)

    database.rollback()
    assert database.query(KnowledgeVersion).count() == 0
    assert database.query(QuizSet).count() == 0


def test_reconciliation_detects_a_tampered_question() -> None:
    database = make_session()
    payload = make_export()
    migrate_phase3_export(database, payload)
    database.commit()
    question = database.query(Question).order_by(Question.id).first()
    assert question is not None
    question.prompt = "被篡改的题目"
    database.commit()

    report = reconcile_phase3_export(database, payload)

    assert report.passed is False
    assert report.source_hash != report.target_hash
    assert report.errors == ["question payload hash mismatch"]
