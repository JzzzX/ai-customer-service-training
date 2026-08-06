"""Export the legacy PostgreSQL schema and import it into MySQL.

The exporter intentionally lives in the Python application so the migration
remains runnable after the legacy application source is removed from ``main``.
The snapshot is a sensitive, short-lived artifact; only its manifest and
redacted reconciliation report belong in the repository or an issue tracker.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timezone
from decimal import Decimal
import hashlib
import json
import os
from pathlib import Path
from typing import Any, Iterable
from uuid import UUID

from sqlalchemy import Engine, MetaData, create_engine, delete, select
from sqlalchemy.engine import Connection, make_url

from app.models import Base
from app.services.phase5_migration import MigrationError, snapshot_database


SCHEMA_VERSION = 1
LEGACY_TABLES = (
    "users",
    "knowledge_versions",
    "knowledge_sources",
    "knowledge_units",
    "quiz_sets",
    "questions",
    "question_reviews",
    "quiz_set_questions",
    "quiz_attempts",
    "quiz_answers",
    "topic_quiz_attempts",
    "topic_quiz_answers",
    "scenarios",
    "scenario_versions",
    "assignments",
    "training_sessions",
    "training_messages",
    "evaluation_reports",
    "review_decisions",
)

TARGET_TABLE_ORDER = (
    "users",
    "knowledge_versions",
    "knowledge_sources",
    "knowledge_units",
    "quiz_sets",
    "questions",
    "quiz_set_questions",
    "question_reviews",
    "scenarios",
    "scenario_versions",
    "assignments",
    "quiz_attempts",
    "quiz_answers",
    "training_sessions",
    "training_messages",
    "evaluation_reports",
    "review_decisions",
)

DERIVED_TARGET_TABLES = {
    "knowledge_progress",
    "scenario_progress_summaries",
    "admin_audit_events",
}

INTENTIONALLY_OMITTED_FIELDS = {
    "users": ("password_hash",),
    "knowledge_progress": ("derived_from_fact_tables",),
    "scenario_progress_summaries": ("derived_from_fact_tables",),
    "admin_audit_events": ("legacy_schema_has_no_equivalent",),
}


def normalize_source_url(url: str) -> str:
    """Use Psycopg 3 for PostgreSQL URLs without changing MySQL/SQLite URLs."""

    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url.removeprefix("postgres://")
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url.removeprefix("postgresql://")
    return url


def _validate_target_url(url: str) -> None:
    if url.startswith("mysql+pymysql://") and "charset=utf8mb4" not in url:
        raise MigrationError("MySQL target URL must include charset=utf8mb4")


def _canonical(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, (UUID, Decimal)):
        return str(value)
    if isinstance(value, bytes):
        return value.hex()
    if isinstance(value, dict):
        return {
            str(key): _canonical(item)
            for key, item in sorted(value.items(), key=lambda item: str(item[0]))
        }
    if isinstance(value, (list, tuple)):
        return [_canonical(item) for item in value]
    if isinstance(value, set):
        return sorted(_canonical(item) for item in value)
    return value


def _source_metadata(engine: Engine) -> MetaData:
    metadata = MetaData()
    metadata.reflect(bind=engine, only=list(LEGACY_TABLES))
    missing = [name for name in LEGACY_TABLES if name not in metadata.tables]
    if missing:
        raise MigrationError(
            "legacy PostgreSQL schema is missing tables: " + ", ".join(missing)
        )
    return metadata


def _ordered_rows(connection: Connection, table: Any) -> list[dict[str, Any]]:
    statement = select(table)
    primary_keys = list(table.primary_key.columns)
    if primary_keys:
        statement = statement.order_by(*primary_keys)
    else:
        statement = statement.order_by(*table.columns)
    return [
        {column.name: _canonical(row[column.name]) for column in table.columns}
        for row in connection.execute(statement).mappings()
    ]


def _snapshot_hash(rows_by_table: dict[str, list[dict[str, Any]]]) -> str:
    payload = [
        {"table": table, "rows": rows_by_table[table]}
        for table in LEGACY_TABLES
    ]
    serialized = json.dumps(
        payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    return hashlib.sha256(serialized).hexdigest()


def _mapped_hash(rows_by_table: dict[str, list[dict[str, Any]]]) -> str:
    """Hash the converted authoritative rows, independent of DB dialect."""

    payload = [
        {"table": table, "rows": rows_by_table.get(table, [])}
        for table in TARGET_TABLE_ORDER
    ]
    serialized = json.dumps(
        _canonical(payload), ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    return hashlib.sha256(serialized).hexdigest()


def _hash_payload(value: Any) -> str:
    serialized = json.dumps(
        _canonical(value), ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    return hashlib.sha256(serialized).hexdigest()


def _evidence_from_rows(
    rows_by_table: dict[str, list[dict[str, Any]]],
    *,
    quiz_set_ids: set[str] | None = None,
) -> dict[str, Any]:
    """Build deterministic, non-sensitive reconciliation evidence."""

    if quiz_set_ids is None:
        quiz_set_ids = {
            str(row["id"])
            for row in rows_by_table.get("quiz_sets", [])
            if row.get("id") is not None
        }
    relation_rows = [
        {
            "quiz_set_id": row.get("quiz_set_id"),
            "question_id": row.get("question_id"),
            "position": row.get("position", 0),
            "points": row.get("points", 1),
        }
        for row in rows_by_table.get("quiz_set_questions", [])
        if str(row.get("quiz_set_id")) in quiz_set_ids
    ]
    relation_rows.sort(
        key=lambda row: (
            str(row.get("quiz_set_id")),
            int(row.get("position") or 0),
            str(row.get("question_id")),
        )
    )
    assignments = []
    for row in rows_by_table.get("assignments", []):
        target_id = row.get("target_id")
        if target_id is None:
            target_id = row.get("quiz_set_id") or row.get("scenario_version_id")
        assignments.append(
            {
                "id": row.get("id"),
                "learner_id": row.get("learner_id"),
                "assigned_by_id": row.get("assigned_by_id"),
                "assignment_type": row.get("assignment_type"),
                "target_id": target_id,
                "status": row.get("status"),
            }
        )
    assignments.sort(key=lambda row: str(row.get("id")))

    message_positions: dict[str, list[int]] = defaultdict(list)
    for row in rows_by_table.get("training_messages", []):
        session_id = row.get("training_session_id")
        if session_id is not None:
            message_positions[str(session_id)].append(int(row.get("position") or 0))
    message_counts = [
        {
            "training_session_id": session_id,
            "count": len(positions),
            "positions": sorted(positions),
        }
        for session_id, positions in sorted(message_positions.items())
    ]

    attempts = list(rows_by_table.get("quiz_attempts", []))
    for row in rows_by_table.get("topic_quiz_attempts", []):
        attempts.append(
            {
                "id": row.get("id"),
                "learner_id": row.get("learner_id"),
                "completed_at": row.get("completed_at"),
            }
        )
    completed_attempts = {
        str(row.get("id")): row
        for row in attempts
        if row.get("id") is not None and row.get("completed_at") is not None
    }
    answers_by_attempt: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows_by_table.get("quiz_answers", []):
        answers_by_attempt[str(row.get("quiz_attempt_id"))].append(row)
    for row in rows_by_table.get("topic_quiz_answers", []):
        answers_by_attempt[str(row.get("topic_quiz_attempt_id"))].append(row)
    sessions_by_learner: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows_by_table.get("training_sessions", []):
        sessions_by_learner[str(row.get("learner_id"))].append(row)
    report_session_ids = {
        str(row.get("training_session_id"))
        for row in rows_by_table.get("evaluation_reports", [])
    }
    sample_user_aggregates = []
    learner_ids = sorted(
        str(row.get("id"))
        for row in rows_by_table.get("users", [])
        if row.get("role", "learner") == "learner" and row.get("id") is not None
    )
    for learner_id in learner_ids[:10]:
        learner_attempts = [
            row
            for row in completed_attempts.values()
            if str(row.get("learner_id")) == learner_id
        ]
        learner_answers = [
            answer
            for attempt in learner_attempts
            for answer in answers_by_attempt.get(str(attempt.get("id")), [])
        ]
        learner_sessions = sessions_by_learner.get(learner_id, [])
        completed_sessions = [
            row
            for row in learner_sessions
            if row.get("status") in {"completed", "needs_review"}
        ]
        sample_user_aggregates.append(
            {
                "user_sha256": hashlib.sha256(learner_id.encode()).hexdigest()[:16],
                "attempt_count": len(learner_attempts),
                "answer_count": len(learner_answers),
                "correct_count": sum(bool(row.get("is_correct")) for row in learner_answers),
                "completed_session_count": len(completed_sessions),
                "report_count": sum(
                    str(row.get("id")) in report_session_ids
                    for row in completed_sessions
                ),
            }
        )

    return {
        "quiz_order_sha256": _hash_payload(relation_rows),
        "assignment_ownership_sha256": _hash_payload(assignments),
        "message_counts_sha256": _hash_payload(message_counts),
        "report_count": len(rows_by_table.get("evaluation_reports", [])),
        "sample_user_aggregates": sample_user_aggregates,
    }


def export_legacy_snapshot(
    source_url: str,
    output: str | Path,
    manifest: str | Path,
    *,
    source_commit: str | None = None,
) -> dict[str, Any]:
    """Export every legacy table into a canonical JSONL snapshot."""

    engine = create_engine(normalize_source_url(source_url), pool_pre_ping=True)
    output_path = Path(output)
    manifest_path = Path(manifest)
    source_commit = source_commit or os.environ.get(
        "LEGACY_SOURCE_COMMIT", "legacy-next-final-bb8d164"
    )
    try:
        metadata = _source_metadata(engine)
        with engine.connect() as connection:
            rows_by_table = {
                table_name: _ordered_rows(connection, metadata.tables[table_name])
                for table_name in LEGACY_TABLES
            }
    finally:
        engine.dispose()

    exported_at = datetime.now(timezone.utc).isoformat()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as stream:
        stream.write(
            json.dumps(
                {
                    "kind": "header",
                    "schema_version": SCHEMA_VERSION,
                    "exported_at": exported_at,
                    "source_commit": source_commit,
                    "tables": list(LEGACY_TABLES),
                },
                ensure_ascii=False,
                sort_keys=True,
            )
            + "\n"
        )
        for table_name in LEGACY_TABLES:
            for row in rows_by_table[table_name]:
                stream.write(
                    json.dumps(
                        {"kind": "row", "table": table_name, "row": row},
                        ensure_ascii=False,
                        sort_keys=True,
                    )
                    + "\n"
                )
    os.chmod(output_path, 0o600)

    result = {
        "schema_version": SCHEMA_VERSION,
        "exported_at": exported_at,
        "source_commit": source_commit,
        "tables": list(LEGACY_TABLES),
        "row_counts": {
            table: len(rows_by_table[table]) for table in LEGACY_TABLES
        },
        "hash": _snapshot_hash(rows_by_table),
        "intentionally_omitted_fields": INTENTIONALLY_OMITTED_FIELDS,
    }
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(
        json.dumps(result, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )
    os.chmod(manifest_path, 0o600)
    return result


def load_legacy_snapshot(path: str | Path) -> tuple[dict[str, Any], dict[str, list[dict[str, Any]]]]:
    header: dict[str, Any] | None = None
    rows: dict[str, list[dict[str, Any]]] = defaultdict(list)
    with Path(path).open(encoding="utf-8") as stream:
        for line_number, line in enumerate(stream, start=1):
            item = json.loads(line)
            if item.get("kind") == "header":
                if header is not None:
                    raise MigrationError("legacy snapshot contains duplicate headers")
                header = item
                continue
            if item.get("kind") != "row" or item.get("table") not in LEGACY_TABLES:
                raise MigrationError(f"invalid legacy snapshot line {line_number}")
            row = item.get("row")
            if not isinstance(row, dict):
                raise MigrationError(f"invalid legacy snapshot row {line_number}")
            rows[item["table"]].append(row)
    if (
        header is None
        or header.get("schema_version") != SCHEMA_VERSION
        or not header.get("exported_at")
        or not header.get("source_commit")
    ):
        raise MigrationError("unsupported or missing legacy snapshot header")
    if tuple(header.get("tables", ())) != LEGACY_TABLES:
        raise MigrationError("legacy snapshot table order does not match schema version")
    return header, {name: rows.get(name, []) for name in LEGACY_TABLES}


def _target_tables() -> dict[str, Any]:
    missing = [name for name in TARGET_TABLE_ORDER if name not in Base.metadata.tables]
    if missing:
        raise MigrationError("target model is missing tables: " + ", ".join(missing))
    return {name: Base.metadata.tables[name] for name in TARGET_TABLE_ORDER}


def _parse_datetime(value: Any) -> Any:
    if value is None or isinstance(value, datetime):
        return value
    if isinstance(value, str):
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    return value


def _row_for(table: Any, values: dict[str, Any]) -> dict[str, Any]:
    columns = {column.name for column in table.columns}
    return {key: value for key, value in values.items() if key in columns}


def _index(rows: Iterable[dict[str, Any]], key: str) -> dict[Any, dict[str, Any]]:
    return {row[key]: row for row in rows if row.get(key) is not None}


def _load_topic_fixture(path: str | Path) -> dict[str, Any]:
    value = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(value, dict) or value.get("schema_version") != SCHEMA_VERSION:
        raise MigrationError("unsupported topic fixture schema version")
    topics = value.get("topics")
    if not isinstance(topics, list) or not topics:
        raise MigrationError("topic fixture must contain at least one topic")
    topic_ids: set[str] = set()
    question_ids: set[str] = set()
    for topic in topics:
        if not isinstance(topic, dict):
            raise MigrationError("topic fixture contains an invalid topic")
        topic_id = str(topic.get("id", ""))
        quiz_hash = str(topic.get("quiz_hash", ""))
        questions = topic.get("questions")
        if not topic_id or not quiz_hash or not isinstance(questions, list):
            raise MigrationError("topic fixture topic is missing id, quiz_hash or questions")
        if topic_id in topic_ids:
            raise MigrationError(f"topic fixture contains duplicate topic: {topic_id}")
        topic_ids.add(topic_id)
        for question in questions:
            if not isinstance(question, dict) or not question.get("id"):
                raise MigrationError("topic fixture contains an invalid question")
            question_id = str(question["id"])
            if question_id in question_ids:
                raise MigrationError(f"topic fixture contains duplicate question: {question_id}")
            question_ids.add(question_id)
    return value


def _map_legacy_rows(
    source: dict[str, list[dict[str, Any]]],
    target: dict[str, Any],
    *,
    topic_fixture: dict[str, Any] | None = None,
) -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    """Map old column names and denormalized records into target rows."""

    mapped: dict[str, list[dict[str, Any]]] = {name: [] for name in TARGET_TABLE_ORDER}
    quiz_sets = _index(source["quiz_sets"], "id")
    knowledge_by_hash = {
        row.get("version_hash"): row
        for row in source["knowledge_versions"]
        if row.get("version_hash")
    }
    source_quiz_by_hash = {
        row.get("quiz_hash"): row
        for row in source["quiz_sets"]
        if row.get("quiz_hash")
    }
    source_units_by_key = _index(source["knowledge_units"], "unit_key")
    admin_id = next(
        (row.get("id") for row in source["users"] if row.get("role") == "admin"),
        None,
    )

    for row in source["users"]:
        mapped["users"].append(
            _row_for(
                target["users"],
                {
                    "id": row["id"],
                    "email": row["email"],
                    "name": row["name"],
                    "role": row.get("role", "learner"),
                    "is_active": row.get("is_active", True),
                    "last_login_at": _parse_datetime(row.get("last_login_at")),
                    "created_at": _parse_datetime(row.get("created_at")),
                    "updated_at": _parse_datetime(row.get("updated_at") or row.get("created_at")),
                },
            )
        )

    for row in source["knowledge_versions"]:
        label = row.get("source_root") or f"legacy-{str(row['id'])[:8]}"
        mapped["knowledge_versions"].append(
            _row_for(
                target["knowledge_versions"],
                {
                    "id": row["id"],
                    "version_hash": row.get("version_hash"),
                    "label": label,
                    "schema_version": row.get("schema_version", 1),
                    "source_root": row.get("source_root", ""),
                    "coverage": row.get("coverage") or {},
                    "status": row.get("status", "draft"),
                    "is_active": row.get("is_active", False),
                    "published_at": _parse_datetime(row.get("published_at")),
                    "created_by_id": row.get("created_by_id"),
                    "created_at": _parse_datetime(row.get("created_at")),
                    "updated_at": _parse_datetime(row.get("updated_at") or row.get("created_at")),
                },
            )
        )

    for table_name in ("knowledge_sources", "knowledge_units"):
        for row in source[table_name]:
            mapped[table_name].append(_row_for(target[table_name], {
                key: (_parse_datetime(value) if key.endswith("_at") else value)
                for key, value in row.items()
            }))

    question_sets: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for relation in source["quiz_set_questions"]:
        question_sets[relation["question_id"]].append(relation)

    for row in source["quiz_sets"]:
        mapped["quiz_sets"].append(
            _row_for(
                target["quiz_sets"],
                {
                    "id": row["id"],
                    "knowledge_version_id": row["knowledge_version_id"],
                    "topic_key": row["id"],
                    "label": row.get("title") or row["id"],
                    "quiz_hash": row.get("quiz_hash"),
                    "source_quiz_hash": row.get("source_quiz_hash"),
                    "description": row.get("description") or "",
                    "passing_score": row.get("passing_score", 80),
                    "status": row.get("status", "draft"),
                    "published_at": _parse_datetime(row.get("published_at")),
                    "created_by_id": row.get("created_by_id"),
                    "created_at": _parse_datetime(row.get("created_at")),
                    "updated_at": _parse_datetime(row.get("updated_at")),
                },
            )
        )

    for row in source["questions"]:
        relations = sorted(question_sets.get(row["id"], []), key=lambda item: (item.get("position", 0), item["quiz_set_id"]))
        primary_set = relations[0]["quiz_set_id"] if relations else None
        mapped["questions"].append(
            _row_for(
                target["questions"],
                {
                    "id": row["id"],
                    "quiz_set_id": primary_set,
                    "knowledge_version_id": row.get("knowledge_version_id"),
                    "knowledge_unit_id": row.get("knowledge_unit_id"),
                    "question_key": row.get("question_key") or row["id"],
                    "question_type": row.get("type", "single_choice"),
                    "prompt": row["prompt"],
                    "options": row.get("options") or [],
                    "correct_answers": row.get("correct_answers") or [],
                    "explanation": row.get("explanation") or "",
                    "category": row.get("category") or "",
                    "difficulty": row.get("difficulty", "easy"),
                    "position": relations[0].get("position", 0) if relations else 0,
                    "status": row.get("status", "draft"),
                    "created_by_id": row.get("created_by_id"),
                    "created_at": _parse_datetime(row.get("created_at")),
                    "updated_at": _parse_datetime(row.get("updated_at")),
                },
            )
        )
    for row in source["quiz_set_questions"]:
        mapped["quiz_set_questions"].append(_row_for(target["quiz_set_questions"], row))
    for row in source["question_reviews"]:
        mapped["question_reviews"].append(_row_for(target["question_reviews"], {
            **row,
            "created_at": _parse_datetime(row.get("created_at")),
        }))

    topic_quiz_set_ids: dict[str, str] = {}
    fixture_questions_by_topic: dict[tuple[str, str], str] = {}
    fixture_topics = (topic_fixture or {}).get("topics", [])
    relation_keys = {
        (row.get("quiz_set_id"), row.get("question_id"))
        for row in mapped["quiz_set_questions"]
    }
    mapped_question_ids = {row.get("id") for row in mapped["questions"]}
    for topic in fixture_topics:
        topic_id = str(topic["id"])
        quiz_hash = str(topic["quiz_hash"])
        source_quiz = source_quiz_by_hash.get(quiz_hash)
        if source_quiz:
            quiz_set_id = str(source_quiz["id"])
        else:
            knowledge = knowledge_by_hash.get(topic_fixture.get("knowledge_version_hash"))
            if not knowledge:
                raise MigrationError(
                    f"topic fixture {topic_id} has no matching knowledge version"
                )
            quiz_set_id = "legacy_topic_" + hashlib.sha256(topic_id.encode()).hexdigest()[:24]
            mapped["quiz_sets"].append(_row_for(target["quiz_sets"], {
                "id": quiz_set_id,
                "knowledge_version_id": knowledge["id"],
                "topic_key": topic_id,
                "label": topic.get("label") or topic_id,
                "quiz_hash": quiz_hash,
                "description": topic.get("description") or "",
                "passing_score": topic.get("passing_score", 80),
                "status": "published",
                "published_at": _parse_datetime(topic.get("published_at")),
                "created_by_id": admin_id,
            }))
        topic_quiz_set_ids[topic_id] = quiz_set_id
        knowledge = knowledge_by_hash.get(topic_fixture.get("knowledge_version_hash"))
        for position, question in enumerate(topic["questions"], start=1):
            question_id = str(question["id"])
            fixture_questions_by_topic[(topic_id, question_id)] = question_id
            if question_id not in mapped_question_ids:
                knowledge_unit = source_units_by_key.get(question.get("knowledge_unit_key"))
                mapped["questions"].append(_row_for(target["questions"], {
                    "id": question_id,
                    "quiz_set_id": quiz_set_id,
                    "knowledge_version_id": knowledge["id"] if knowledge else None,
                    "knowledge_unit_id": knowledge_unit.get("id") if knowledge_unit else None,
                    "question_key": question_id,
                    "question_type": question.get("question_type", "single_choice"),
                    "prompt": question["prompt"],
                    "options": question.get("options") or [],
                    "correct_answers": question.get("correct_answers") or [],
                    "explanation": question.get("explanation") or "",
                    "category": question.get("category") or topic_id,
                    "difficulty": question.get("difficulty", "easy"),
                    "position": question.get("position", position),
                    "status": question.get("status", "published"),
                    "created_by_id": admin_id,
                }))
                mapped_question_ids.add(question_id)
            relation_key = (quiz_set_id, question_id)
            if relation_key not in relation_keys:
                mapped["quiz_set_questions"].append(_row_for(target["quiz_set_questions"], {
                    "quiz_set_id": quiz_set_id,
                    "question_id": question_id,
                    "position": question.get("position", position),
                    "points": question.get("points", 1),
                }))
                relation_keys.add(relation_key)

    question_ids_by_set_and_key = {
        (relation["quiz_set_id"], next(
            (
                row.get("question_key", row["id"])
                for row in mapped["questions"]
                if row.get("id") == relation.get("question_id")
            ), relation["question_id"]
        )): relation["question_id"]
        for relation in mapped["quiz_set_questions"]
        if relation.get("question_id")
    }
    quiz_set_knowledge_versions = {
        row.get("id"): row.get("knowledge_version_id")
        for row in mapped["quiz_sets"]
    }
    quiz_set_by_topic = {
        **{row["id"]: row["id"] for row in source["quiz_sets"]},
        **topic_quiz_set_ids,
    }
    quiz_set_by_hash = {
        row.get("quiz_hash"): row["id"]
        for row in source["quiz_sets"]
        if row.get("quiz_hash")
    }

    regular_answers = defaultdict(list)
    for row in source["quiz_answers"]:
        regular_answers[row["quiz_attempt_id"]].append(row)
    for row in source["quiz_attempts"]:
        answers = regular_answers.get(row["id"], [])
        values = {
            key: (_parse_datetime(value) if key.endswith("_at") else value)
            for key, value in row.items()
        }
        values.update(
            {
                "question_ids": [answer["question_id"] for answer in answers],
                "origin": "legacy_quiz",
            }
        )
        mapped["quiz_attempts"].append(_row_for(target["quiz_attempts"], values))
        for answer in answers:
            mapped["quiz_answers"].append(_row_for(target["quiz_answers"], {
                **answer,
                "answered_at": _parse_datetime(answer.get("answered_at")),
            }))

    topic_answers = defaultdict(list)
    for row in source["topic_quiz_answers"]:
        topic_answers[row["topic_quiz_attempt_id"]].append(row)
    for row in source["topic_quiz_attempts"]:
        quiz_set_id = quiz_set_by_hash.get(row.get("quiz_hash")) or quiz_set_by_topic.get(row.get("topic_id"))
        if not quiz_set_id:
            raise MigrationError(
                f"topic quiz attempt {row['id']} has no matching quiz_set for topic/hash"
            )
        answers = topic_answers.get(row["id"], [])
        question_ids: list[str] = []
        for answer in answers:
            question_id = question_ids_by_set_and_key.get((quiz_set_id, answer["question_key"]))
            if not question_id:
                question_id = fixture_questions_by_topic.get(
                    (row.get("topic_id", ""), answer.get("question_key", ""))
                )
            if not question_id:
                raise MigrationError(
                    f"topic quiz answer {answer['id']} has no matching question"
                )
            question_ids.append(question_id)
        mapped["quiz_attempts"].append(
            _row_for(
                target["quiz_attempts"],
                {
                    "id": row["id"],
                    "learner_id": row["learner_id"],
                    "quiz_set_id": quiz_set_id,
                    "knowledge_version_id": quiz_set_knowledge_versions[quiz_set_id],
                    "question_ids": question_ids,
                    "status": row.get("status", "needs_retry"),
                    "correct_count": row.get("correct_count", 0),
                    "total_questions": row.get("total_questions", len(question_ids)),
                    "score": row.get("score"),
                    "started_at": _parse_datetime(row.get("created_at")),
                    "completed_at": _parse_datetime(row.get("completed_at")),
                    "origin": "legacy_topic",
                },
            )
        )
        for answer, question_id in zip(answers, question_ids, strict=True):
            mapped["quiz_answers"].append(_row_for(target["quiz_answers"], {
                "id": answer["id"],
                "quiz_attempt_id": row["id"],
                "question_id": question_id,
                "selected_answers": answer.get("selected_answers") or [],
                "is_correct": answer.get("is_correct", False),
                "answered_at": _parse_datetime(answer.get("answered_at")),
                "source_question_key": answer.get("question_key"),
            }))

    for table_name in ("scenarios", "scenario_versions", "training_sessions", "training_messages", "evaluation_reports", "review_decisions"):
        for row in source[table_name]:
            values = dict(row)
            if table_name == "scenario_versions":
                values["opening_message"] = values.pop("first_customer_message", values.get("opening_message", ""))
            if table_name == "training_messages":
                values["metadata"] = values.pop("metadata", values.get("metadata_json", {}))
            values = {key: (_parse_datetime(value) if key.endswith("_at") else value) for key, value in values.items()}
            mapped[table_name].append(_row_for(target[table_name], values))

    scenario_labels = {row["id"]: row.get("title", row["id"]) for row in source["scenarios"]}
    version_labels = {row["id"]: scenario_labels.get(row.get("scenario_id"), row["id"]) for row in source["scenario_versions"]}
    for row in source["assignments"]:
        target_id = row.get("quiz_set_id") or row.get("scenario_version_id")
        target_label = (
            quiz_sets.get(target_id, {}).get("title")
            if row.get("quiz_set_id")
            else version_labels.get(target_id)
        ) or str(target_id or "")
        mapped["assignments"].append(_row_for(target["assignments"], {
            "id": row["id"],
            "learner_id": row["learner_id"],
            "assigned_by_id": row["assigned_by_id"],
            "assignment_type": row.get("assignment_type", "quiz"),
            "target_id": target_id,
            "target_label": target_label,
            "status": row.get("status", "assigned"),
            "due_at": _parse_datetime(row.get("due_at")),
            "started_at": _parse_datetime(row.get("started_at")),
            "completed_at": _parse_datetime(row.get("completed_at")),
            "created_at": _parse_datetime(row.get("created_at")),
        }))

    return mapped, {
        "source_row_counts": {name: len(rows) for name, rows in source.items()},
        "target_row_counts": {name: len(rows) for name, rows in mapped.items()},
        "intentionally_omitted_fields": INTENTIONALLY_OMITTED_FIELDS,
    }


def _rebuild_derived_progress(connection: Connection) -> None:
    """Rebuild overview read models from imported fact tables.

    The legacy PostgreSQL schema did not contain these read models.  They are
    intentionally rebuilt after the authoritative rows are committed to the
    target transaction, so stale aggregates can never become migration facts.
    The implementation uses SQLAlchemy Core primitives and therefore works for
    both SQLite rehearsal databases and MySQL production targets.
    """

    tables = Base.metadata.tables
    users = tables["users"]
    knowledge_versions = tables["knowledge_versions"]
    quiz_sets = tables["quiz_sets"]
    questions = tables["questions"]
    relations = tables["quiz_set_questions"]
    attempts = tables["quiz_attempts"]
    answers = tables["quiz_answers"]
    scenarios = tables["scenarios"]
    scenario_versions = tables["scenario_versions"]
    sessions = tables["training_sessions"]
    reports = tables["evaluation_reports"]
    knowledge_progress = tables["knowledge_progress"]
    scenario_progress = tables["scenario_progress_summaries"]

    connection.execute(delete(knowledge_progress))
    connection.execute(delete(scenario_progress))

    learner_ids = [
        row.id
        for row in connection.execute(
            select(users.c.id).where(users.c.role == "learner")
        ).mappings()
    ]

    active_set_ids = {
        row.id
        for row in connection.execute(
            select(quiz_sets.c.id)
            .join(
                knowledge_versions,
                quiz_sets.c.knowledge_version_id == knowledge_versions.c.id,
            )
            .where(
                quiz_sets.c.status == "published",
                knowledge_versions.c.status == "published",
                knowledge_versions.c.is_active.is_(True),
            )
        ).mappings()
    }
    active_question_rows = connection.execute(
        select(questions.c.id)
        .join(relations, relations.c.question_id == questions.c.id)
        .where(
            relations.c.quiz_set_id.in_(active_set_ids or [""]),
            questions.c.status == "published",
        )
    ).all()
    active_question_count = len(active_question_rows)

    attempt_rows = list(
        connection.execute(
            select(
                attempts.c.id,
                attempts.c.learner_id,
                attempts.c.completed_at,
            )
        ).mappings()
    )
    completed_attempts = [row for row in attempt_rows if row.completed_at is not None]
    completed_attempt_ids = {row.id for row in completed_attempts}
    answer_rows = [
        row
        for row in connection.execute(
            select(
                answers.c.quiz_attempt_id,
                answers.c.question_id,
                answers.c.is_correct,
            )
        ).mappings()
        if row.quiz_attempt_id in completed_attempt_ids
    ]
    answers_by_attempt: dict[str, list[Any]] = defaultdict(list)
    for row in answer_rows:
        answers_by_attempt[row.quiz_attempt_id].append(row)

    for learner_id in learner_ids:
        learner_attempts = [
            row for row in completed_attempts if row.learner_id == learner_id
        ]
        learner_answers = [
            answer
            for attempt in learner_attempts
            for answer in answers_by_attempt.get(attempt.id, [])
        ]
        correct_count = sum(bool(answer.is_correct) for answer in learner_answers)
        answered_count = len(learner_answers)
        connection.execute(
            knowledge_progress.insert(),
            {
                "learner_id": learner_id,
                "total_questions": active_question_count,
                "unique_answered_count": len(
                    {answer.question_id for answer in learner_answers}
                ),
                "total_correct_answers": correct_count,
                "total_answered_answers": answered_count,
                "accuracy": round(correct_count / answered_count * 100)
                if answered_count
                else 0,
                "attempt_count": len(learner_attempts),
            },
        )

    published_scenario_ids = {
        row.id
        for row in connection.execute(
            select(scenarios.c.id)
            .join(scenario_versions, scenario_versions.c.scenario_id == scenarios.c.id)
            .where(
                scenarios.c.status == "published",
                scenario_versions.c.status == "published",
            )
            .distinct()
        ).mappings()
    }
    version_to_scenario = {
        row.id: row.scenario_id
        for row in connection.execute(
            select(scenario_versions.c.id, scenario_versions.c.scenario_id)
        ).mappings()
    }
    session_rows = list(
        connection.execute(
            select(
                sessions.c.id,
                sessions.c.learner_id,
                sessions.c.scenario_version_id,
                sessions.c.status,
            )
        ).mappings()
    )
    report_by_session = {
        row.training_session_id: row
        for row in connection.execute(
            select(
                reports.c.training_session_id,
                reports.c.total_score,
                reports.c.created_at,
            )
        ).mappings()
    }
    for learner_id in learner_ids:
        learner_sessions = [
            row for row in session_rows if row.learner_id == learner_id
        ]
        completed_sessions = [
            row
            for row in learner_sessions
            if row.status in {"completed", "needs_review"}
        ]
        completed_scenario_ids = {
            version_to_scenario[row.scenario_version_id]
            for row in completed_sessions
            if row.scenario_version_id in version_to_scenario
        }
        scored_reports = [
            report_by_session[row.id]
            for row in completed_sessions
            if row.id in report_by_session
            and report_by_session[row.id].total_score is not None
        ]
        scored_reports.sort(
            key=lambda row: (
                row.created_at or datetime.min.replace(tzinfo=timezone.utc),
                row.training_session_id,
            ),
            reverse=True,
        )
        recent_scores = [row.total_score for row in scored_reports[:5]]
        connection.execute(
            scenario_progress.insert(),
            {
                "learner_id": learner_id,
                "published_scenario_count": len(published_scenario_ids),
                "completed_scenario_count": len(completed_scenario_ids),
                "completed_session_count": len(completed_sessions),
                "recent_average_score": round(sum(recent_scores) / len(recent_scores))
                if recent_scores
                else 0,
            },
        )


def import_legacy_snapshot(
    snapshot: str | Path,
    target_url: str,
    report: str | Path,
    *,
    replace_empty_target: bool = False,
    target_name: str | None = None,
    topic_fixture: str | Path | None = None,
) -> dict[str, Any]:
    """Atomically import a snapshot into an empty target schema."""

    _validate_target_url(target_url)
    header, source = load_legacy_snapshot(snapshot)
    target = _target_tables()
    fixture = _load_topic_fixture(topic_fixture) if topic_fixture else None
    if source["topic_quiz_attempts"] and fixture is None:
        raise MigrationError(
            "topic quiz attempts require --topic-fixture with the versioned static question bank"
        )
    mapped, mapping_report = _map_legacy_rows(source, target, topic_fixture=fixture)
    mapped_hash = _mapped_hash(mapped)
    source_evidence = _evidence_from_rows(source)
    engine = create_engine(target_url, pool_pre_ping=True)
    try:
        with engine.connect() as connection:
            before = snapshot_database(connection)
        if not all(count == 0 for count in before["row_counts"].values()):
            if not replace_empty_target:
                raise MigrationError(
                    "target database is not empty; pass --replace-empty-target only for an isolated target"
                )
            if not target_name:
                raise MigrationError(
                    "replace-empty-target requires --target-name matching the target database name"
                )
            database_name = make_url(target_url).database
            if not database_name or target_name != database_name:
                raise MigrationError(
                    "--target-name must exactly match the target database name"
                )

        with engine.begin() as connection:
            if not all(count == 0 for count in before["row_counts"].values()):
                for table in reversed(Base.metadata.sorted_tables):
                    connection.execute(delete(table))
            for table_name in TARGET_TABLE_ORDER:
                rows = mapped[table_name]
                for row in rows:
                    connection.execute(target[table_name].insert(), row)
            _rebuild_derived_progress(connection)

        with engine.connect() as connection:
            after = snapshot_database(connection)
            target_rows = {
                table_name: _ordered_rows(connection, target[table_name])
                for table_name in TARGET_TABLE_ORDER
            }
            target_evidence = _evidence_from_rows(
                target_rows,
                quiz_set_ids={
                    str(row["id"])
                    for row in source["quiz_sets"]
                    if row.get("id") is not None
                },
            )
        evidence_checks = {
            "quiz_order": source_evidence["quiz_order_sha256"]
            == target_evidence["quiz_order_sha256"],
            "assignment_ownership": source_evidence["assignment_ownership_sha256"]
            == target_evidence["assignment_ownership_sha256"],
            "message_counts": source_evidence["message_counts_sha256"]
            == target_evidence["message_counts_sha256"],
            "report_count": source_evidence["report_count"]
            == target_evidence["report_count"],
            "sample_user_aggregates": source_evidence["sample_user_aggregates"]
            == target_evidence["sample_user_aggregates"],
        }
        result = {
            "schema_version": SCHEMA_VERSION,
            "source_commit": header["source_commit"],
            "source": {
                "hash": _snapshot_hash(source),
                "row_counts": {name: len(rows) for name, rows in source.items()},
            },
            "target_name": make_url(target_url).database,
            "source_snapshot_hash": _snapshot_hash(source),
            "mapped_fact_hash": mapped_hash,
            "mapping": mapping_report,
            "target": after,
            "topic_fixture": fixture.get("export_hash") if fixture else None,
            "evidence": {
                "source": source_evidence,
                "target": target_evidence,
                "checks": evidence_checks,
            },
            "match": not after["foreign_key_orphans"] and all(evidence_checks.values()),
        }
        report_path = Path(report)
        report_path.write_text(
            json.dumps(result, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
            encoding="utf-8",
        )
        os.chmod(report_path, 0o600)
        return result
    except Exception:
        # The engine.begin() transaction rolls back all target writes. Keep the
        # explicit error boundary so callers never mistake a partial import for
        # a successful migration.
        raise
    finally:
        engine.dispose()


def reconcile_legacy_manifest(manifest: str | Path, report: str | Path) -> dict[str, Any]:
    """Reconcile an import report against its export manifest in place."""

    manifest_value = json.loads(Path(manifest).read_text(encoding="utf-8"))
    if manifest_value.get("schema_version") != SCHEMA_VERSION:
        raise MigrationError("unsupported legacy manifest schema version")
    report_path = Path(report)
    if not report_path.exists():
        raise MigrationError("import report does not exist; run import before reconcile")
    import_value = json.loads(report_path.read_text(encoding="utf-8"))
    checks = {
        "schema_version": import_value.get("schema_version") == SCHEMA_VERSION,
        "source_commit": import_value.get("source_commit") == manifest_value.get("source_commit"),
        "source_hash": import_value.get("source_snapshot_hash") == manifest_value.get("hash"),
        "source_row_counts": import_value.get("source", {}).get("row_counts") == manifest_value.get("row_counts"),
        "foreign_key_orphans": not import_value.get("target", {}).get("foreign_key_orphans"),
        "import_match": import_value.get("match") is True,
        "evidence": all(
            import_value.get("evidence", {}).get("checks", {}).values()
        ),
    }
    reconciled = all(checks.values())
    result = {
        **import_value,
        "reconciled": reconciled,
        "reconciliation": {
            "checks": checks,
            "manifest_hash": manifest_value.get("hash"),
            "mapped_fact_hash": import_value.get("mapped_fact_hash"),
        },
    }
    report_path.write_text(
        json.dumps(result, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )
    os.chmod(report_path, 0o600)
    if not reconciled:
        raise MigrationError("legacy manifest and import report do not reconcile")
    return result
