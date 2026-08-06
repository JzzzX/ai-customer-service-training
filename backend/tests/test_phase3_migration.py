import copy
import json
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, KnowledgeUnit, KnowledgeVersion, Question, QuizSet
from app.services.phase3_migration import (
    migrate_phase3_export,
    reconcile_phase3_export,
)
FIXTURE_PATH = Path(__file__).parent / "fixtures" / "phase3-export.json"


def make_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def make_export() -> dict[str, object]:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


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
