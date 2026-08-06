from __future__ import annotations

import json
from pathlib import Path

import pytest
from sqlalchemy import Column, MetaData, String, Table, create_engine, select
from sqlalchemy.orm import Session

from app.models import (
    Base,
    KnowledgeProgress,
    QuestionReview,
    QuizAnswer,
    QuizAttempt,
    QuizSet,
    ScenarioProgressSummary,
    User,
)
from app.services.legacy_migration import (
    LEGACY_TABLES,
    SCHEMA_VERSION,
    _load_topic_fixture,
    import_legacy_snapshot,
    export_legacy_snapshot,
    reconcile_legacy_manifest,
)
from app.services.phase5_migration import MigrationError


def legacy_rows() -> dict[str, list[dict[str, object]]]:
    created = "2026-08-06T01:02:03+00:00"
    rows = {name: [] for name in LEGACY_TABLES}
    rows["users"] = [
        {
            "id": "user-1",
            "email": "learner@example.test",
            "name": "迁移学员",
            "password_hash": "must-not-be-imported",
            "role": "learner",
            "is_active": True,
            "last_login_at": None,
            "created_at": created,
            "updated_at": created,
        },
        {
            "id": "admin-1",
            "email": "admin@example.test",
            "name": "迁移管理员",
            "password_hash": "must-not-be-imported",
            "role": "admin",
            "is_active": True,
            "last_login_at": None,
            "created_at": created,
            "updated_at": created,
        },
    ]
    rows["knowledge_versions"] = [
        {
            "id": "knowledge-1",
            "version_hash": "k" * 64,
            "schema_version": 1,
            "source_root": "legacy/knowledge",
            "status": "published",
            "is_active": True,
            "coverage": {"units": 1},
            "published_at": created,
            "created_by_id": "admin-1",
            "created_at": created,
        }
    ]
    rows["knowledge_sources"] = [
        {
            "id": "source-1",
            "knowledge_version_id": "knowledge-1",
            "source_path": "returns.md",
            "kind": "markdown",
            "source_hash": "s" * 64,
            "bytes": 10,
            "stats": {"units": 1},
            "created_at": created,
        }
    ]
    rows["knowledge_units"] = [
        {
            "id": "unit-1",
            "knowledge_version_id": "knowledge-1",
            "unit_key": "returns",
            "title": "退换货",
            "content": "七天内可退换。",
            "category_path": ["售后"],
            "semantic_key": "returns",
            "content_hash": "u" * 64,
            "sources": [{"source_path": "returns.md"}],
            "has_conflict": False,
            "can_use_for_quiz": True,
            "can_use_for_scenario": True,
            "can_use_for_evaluation": True,
            "created_at": created,
        }
    ]
    rows["quiz_sets"] = [
        {
            "id": "quiz-1",
            "knowledge_version_id": "knowledge-1",
            "quiz_hash": "q" * 64,
            "source_quiz_hash": None,
            "title": "退换货专题",
            "description": "退换货规则",
            "status": "published",
            "passing_score": 80,
            "published_at": created,
            "created_by_id": "admin-1",
            "created_at": created,
            "updated_at": created,
        }
    ]
    rows["questions"] = [
        {
            "id": "question-1",
            "knowledge_version_id": "knowledge-1",
            "knowledge_unit_id": "unit-1",
            "question_key": "returns-1",
            "type": "single_choice",
            "prompt": "退换货期限？",
            "options": ["七天", "三十天"],
            "correct_answers": ["七天"],
            "explanation": "依据知识库。",
            "category": "售后",
            "difficulty": "easy",
            "status": "published",
            "created_by_id": "admin-1",
            "created_at": created,
            "updated_at": created,
        }
    ]
    rows["quiz_set_questions"] = [
        {"quiz_set_id": "quiz-1", "question_id": "question-1", "position": 1, "points": 1}
    ]
    rows["question_reviews"] = [
        {
            "id": "question-review-1",
            "question_id": "question-1",
            "reviewer_id": "admin-1",
            "content_hash": "r" * 64,
            "snapshot": {"prompt": "退换货期限？", "status": "approved"},
            "created_at": created,
        }
    ]
    rows["quiz_attempts"] = [
        {
            "id": "attempt-1",
            "assignment_id": None,
            "quiz_set_id": "quiz-1",
            "learner_id": "user-1",
            "knowledge_version_id": "knowledge-1",
            "status": "passed",
            "correct_count": 1,
            "total_questions": 1,
            "score": 100,
            "started_at": created,
            "completed_at": created,
        }
    ]
    rows["quiz_answers"] = [
        {
            "id": "answer-1",
            "quiz_attempt_id": "attempt-1",
            "question_id": "question-1",
            "selected_answers": ["七天"],
            "is_correct": True,
            "answered_at": created,
        }
    ]
    return rows


def write_snapshot(path: Path, rows: dict[str, list[dict[str, object]]] | None = None) -> None:
    rows = rows or legacy_rows()
    with path.open("w", encoding="utf-8") as stream:
        stream.write(
            json.dumps(
                {
                    "kind": "header",
                    "schema_version": SCHEMA_VERSION,
                    "exported_at": "2026-08-06T01:02:03+00:00",
                    "source_commit": "legacy-next-final-bb8d164",
                    "tables": list(LEGACY_TABLES),
                },
                ensure_ascii=False,
                sort_keys=True,
            )
            + "\n"
        )
        for table in LEGACY_TABLES:
            for row in rows[table]:
                stream.write(
                    json.dumps(
                        {"kind": "row", "table": table, "row": row},
                        ensure_ascii=False,
                        sort_keys=True,
                    )
                    + "\n"
                )


def test_legacy_snapshot_import_preserves_relations_and_omits_password(tmp_path: Path) -> None:
    snapshot = tmp_path / "legacy.jsonl"
    report = tmp_path / "import-report.json"
    target_path = tmp_path / "target.db"
    write_snapshot(snapshot)
    engine = create_engine(f"sqlite+pysqlite:///{target_path}")
    Base.metadata.create_all(engine)

    result = import_legacy_snapshot(
        snapshot,
        f"sqlite+pysqlite:///{target_path}",
        report,
    )

    assert result["match"] is True
    assert result["mapping"]["target_row_counts"]["quiz_set_questions"] == 1
    with Session(engine) as database:
        user = database.get(User, "user-1")
        quiz_set = database.get(QuizSet, "quiz-1")
        review = database.scalar(select(QuestionReview))
        assert user is not None
        assert not hasattr(user, "password_hash")
        assert quiz_set is not None
        assert [question.id for question in quiz_set.questions] == ["question-1"]
        assert review is not None
        assert review.snapshot["status"] == "approved"
        knowledge_progress = database.get(KnowledgeProgress, "user-1")
        scenario_progress = database.get(ScenarioProgressSummary, "user-1")
        assert knowledge_progress is not None
        assert knowledge_progress.total_questions == 1
        assert knowledge_progress.unique_answered_count == 1
        assert knowledge_progress.accuracy == 100
        assert knowledge_progress.attempt_count == 1
        assert scenario_progress is not None
        assert scenario_progress.completed_session_count == 0


def test_legacy_import_refuses_non_empty_target(tmp_path: Path) -> None:
    snapshot = tmp_path / "legacy.jsonl"
    report = tmp_path / "import-report.json"
    target_path = tmp_path / "target.db"
    write_snapshot(snapshot)
    engine = create_engine(f"sqlite+pysqlite:///{target_path}")
    Base.metadata.create_all(engine)
    with Session(engine) as database:
        database.add(User(id="existing", email="existing@example.test", name="已有", role="learner"))
        database.commit()

    with pytest.raises(MigrationError, match="target database is not empty"):
        import_legacy_snapshot(snapshot, f"sqlite+pysqlite:///{target_path}", report)


def test_manifest_reconciliation_is_redacted(tmp_path: Path) -> None:
    manifest = tmp_path / "manifest.json"
    report = tmp_path / "reconcile.json"
    manifest_value = {
        "schema_version": SCHEMA_VERSION,
        "source_commit": "legacy-next-final-bb8d164",
        "row_counts": {name: 0 for name in LEGACY_TABLES},
        "hash": "h" * 64,
        "intentionally_omitted_fields": {"users": ["password_hash"]},
    }
    manifest.write_text(
        json.dumps(
            manifest_value
        ),
        encoding="utf-8",
    )
    report.write_text(
        json.dumps(
            {
                "schema_version": SCHEMA_VERSION,
                "source_commit": "legacy-next-final-bb8d164",
                "source_snapshot_hash": "h" * 64,
                "source": {"row_counts": manifest_value["row_counts"]},
                "target": {"foreign_key_orphans": []},
                "match": True,
                "mapped_fact_hash": "m" * 64,
            }
        ),
        encoding="utf-8",
    )
    result = reconcile_legacy_manifest(manifest, report)
    assert result["reconciled"] is True
    assert result["reconciliation"]["checks"]["source_hash"] is True
    assert "learner@example.test" not in report.read_text(encoding="utf-8")


def test_exporter_writes_canonical_header_and_manifest(tmp_path: Path) -> None:
    source_path = tmp_path / "source.db"
    metadata = MetaData()
    for table_name in LEGACY_TABLES:
        Table(table_name, metadata, Column("id", String(64), primary_key=True))
    engine = create_engine(f"sqlite+pysqlite:///{source_path}")
    metadata.create_all(engine)

    snapshot = tmp_path / "export.jsonl"
    manifest = tmp_path / "export-manifest.json"
    result = export_legacy_snapshot(
        f"sqlite+pysqlite:///{source_path}", snapshot, manifest
    )

    assert result["schema_version"] == 1
    assert json.loads(snapshot.read_text(encoding="utf-8").splitlines()[0])["exported_at"]
    assert result["row_counts"]["users"] == 0
    assert json.loads(snapshot.read_text(encoding="utf-8").splitlines()[0])["kind"] == "header"
    assert manifest.exists()


def test_topic_attempts_use_versioned_fixture_and_merge_into_quiz_attempts(tmp_path: Path) -> None:
    rows = legacy_rows()
    rows["topic_quiz_attempts"] = [
        {
            "id": "topic-attempt-1",
            "learner_id": "user-1",
            "topic_id": "returns",
            "quiz_hash": "t" * 64,
            "status": "passed",
            "correct_count": 1,
            "total_questions": 1,
            "score": 100,
            "completed_at": "2026-08-06T01:02:03+00:00",
            "created_at": "2026-08-06T01:02:03+00:00",
        }
    ]
    rows["topic_quiz_answers"] = [
        {
            "id": "topic-answer-1",
            "topic_quiz_attempt_id": "topic-attempt-1",
            "question_key": "qq_topic_1",
            "selected_answers": ["七天"],
            "is_correct": True,
            "answered_at": "2026-08-06T01:02:03+00:00",
        }
    ]
    snapshot = tmp_path / "legacy-topic.jsonl"
    report = tmp_path / "topic-report.json"
    write_snapshot(snapshot, rows)
    fixture = tmp_path / "topic-fixture.json"
    fixture.write_text(
        json.dumps(
            {
                "schema_version": SCHEMA_VERSION,
                "knowledge_version_hash": "k" * 64,
                "topics": [
                    {
                        "id": "returns",
                        "label": "退换货",
                        "description": "售后政策",
                        "quiz_hash": "t" * 64,
                        "questions": [
                            {
                                "id": "qq_topic_1",
                                "prompt": "退换货期限？",
                                "options": ["七天", "三十天"],
                                "correct_answers": ["七天"],
                                "question_type": "single_choice",
                                "category": "returns",
                                "position": 1,
                            }
                        ],
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    target_path = tmp_path / "topic-target.db"
    engine = create_engine(f"sqlite+pysqlite:///{target_path}")
    Base.metadata.create_all(engine)

    result = import_legacy_snapshot(
        snapshot,
        f"sqlite+pysqlite:///{target_path}",
        report,
        topic_fixture=fixture,
    )

    assert result["match"] is True
    with Session(engine) as database:
        attempt = database.get(QuizAttempt, "topic-attempt-1")
        assert attempt is not None
        assert attempt.origin == "legacy_topic"
        assert attempt.answers[0].question_id == "qq_topic_1"
        assert database.get(QuizAnswer, "topic-answer-1") is not None


def test_checked_in_topic_fixture_preserves_full_legacy_bank() -> None:
    fixture = _load_topic_fixture(
        Path(__file__).parent / "fixtures" / "legacy-topic-question-bank.json"
    )
    assert len(fixture["topics"]) == 5
    assert sum(len(topic["questions"]) for topic in fixture["topics"]) == 350
