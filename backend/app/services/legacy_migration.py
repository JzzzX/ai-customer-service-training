"""Export the legacy Drizzle/PostgreSQL schema and import it into MySQL.

The exporter intentionally lives in the Python application so the migration
remains runnable after the legacy Next.js source is removed from ``main``.
The snapshot is a sensitive, short-lived artifact; only its manifest and
redacted reconciliation report belong in the repository or an issue tracker.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal
import hashlib
import json
import os
from pathlib import Path
from typing import Any, Iterable
from uuid import UUID

from sqlalchemy import Engine, MetaData, create_engine, select
from sqlalchemy.engine import Connection

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

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as stream:
        stream.write(
            json.dumps(
                {
                    "kind": "header",
                    "schema_version": SCHEMA_VERSION,
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
    if header is None or header.get("schema_version") != SCHEMA_VERSION:
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


def _map_legacy_rows(
    source: dict[str, list[dict[str, Any]]], target: dict[str, Any]
) -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    """Map old column names and denormalized records into target rows."""

    mapped: dict[str, list[dict[str, Any]]] = {name: [] for name in TARGET_TABLE_ORDER}
    users = _index(source["users"], "id")
    versions = _index(source["knowledge_versions"], "id")
    quiz_sets = _index(source["quiz_sets"], "id")
    scenarios = _index(source["scenarios"], "id")
    scenario_versions = _index(source["scenario_versions"], "id")
    questions = _index(source["questions"], "id")

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

    question_ids_by_set_and_key = {
        (relation["quiz_set_id"], questions[relation["question_id"]].get("question_key", relation["question_id"])): relation["question_id"]
        for relation in source["quiz_set_questions"]
        if relation.get("question_id") in questions
    }
    quiz_set_by_topic = {row["id"]: row["id"] for row in source["quiz_sets"]}
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

    topic_attempt_ids: dict[str, str] = {}
    topic_answers = defaultdict(list)
    for row in source["topic_quiz_answers"]:
        topic_answers[row["topic_quiz_attempt_id"]].append(row)
    for row in source["topic_quiz_attempts"]:
        quiz_set_id = quiz_set_by_hash.get(row.get("quiz_hash")) or quiz_set_by_topic.get(row.get("topic_id"))
        if not quiz_set_id:
            raise MigrationError(
                f"topic quiz attempt {row['id']} has no matching quiz_set for topic/hash"
            )
        topic_attempt_ids[row["id"]] = row["id"]
        answers = topic_answers.get(row["id"], [])
        question_ids: list[str] = []
        for answer in answers:
            question_id = question_ids_by_set_and_key.get(
                (quiz_set_id, answer["question_key"])
            )
            if not question_id:
                raise MigrationError(
                    f"topic quiz answer {answer['id']} has no matching question"
                )
            question_ids.append(question_id)
        mapped["quiz_attempts"].append(_row_for(target["quiz_attempts"], {
            "id": row["id"],
            "learner_id": row["learner_id"],
            "quiz_set_id": quiz_set_id,
            "knowledge_version_id": quiz_sets[quiz_set_id]["knowledge_version_id"],
            "question_ids": question_ids,
            "status": row.get("status", "needs_retry"),
            "correct_count": row.get("correct_count", 0),
            "total_questions": row.get("total_questions", len(question_ids)),
            "score": row.get("score"),
            "started_at": _parse_datetime(row.get("created_at")),
            "completed_at": _parse_datetime(row.get("completed_at")),
            "origin": "legacy_topic",
        }))
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


def import_legacy_snapshot(
    snapshot: str | Path,
    target_url: str,
    report: str | Path,
    *,
    replace_empty_target: bool = False,
) -> dict[str, Any]:
    """Atomically import a snapshot into an empty target schema."""

    header, source = load_legacy_snapshot(snapshot)
    target = _target_tables()
    mapped, mapping_report = _map_legacy_rows(source, target)
    engine = create_engine(target_url, pool_pre_ping=True)
    try:
        with engine.connect() as connection:
            before = snapshot_database(connection)
        if not all(count == 0 for count in before["row_counts"].values()):
            if not replace_empty_target:
                raise MigrationError(
                    "target database is not empty; pass --replace-empty-target only for an isolated target"
                )
            raise MigrationError("replace-empty-target requires a separately provisioned empty schema")

        with engine.begin() as connection:
            for table_name in TARGET_TABLE_ORDER:
                rows = mapped[table_name]
                if rows:
                    connection.execute(target[table_name].insert(), rows)

        with engine.connect() as connection:
            after = snapshot_database(connection)
        result = {
            "schema_version": SCHEMA_VERSION,
            "source_commit": header["source_commit"],
            "source_snapshot_hash": _snapshot_hash(source),
            "mapping": mapping_report,
            "target": after,
            "match": not after["foreign_key_orphans"],
        }
        Path(report).write_text(
            json.dumps(result, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
            encoding="utf-8",
        )
        return result
    except Exception:
        # The engine.begin() transaction rolls back all target writes. Keep the
        # explicit error boundary so callers never mistake a partial import for
        # a successful migration.
        raise
    finally:
        engine.dispose()


def reconcile_legacy_manifest(manifest: str | Path, report: str | Path) -> dict[str, Any]:
    """Validate a manifest without opening the sensitive snapshot."""

    value = json.loads(Path(manifest).read_text(encoding="utf-8"))
    if value.get("schema_version") != SCHEMA_VERSION:
        raise MigrationError("unsupported legacy manifest schema version")
    result = {
        "schema_version": SCHEMA_VERSION,
        "source_commit": value.get("source_commit"),
        "row_counts": value.get("row_counts", {}),
        "hash": value.get("hash"),
        "intentionally_omitted_fields": value.get("intentionally_omitted_fields", {}),
        "reconciled": True,
    }
    Path(report).write_text(
        json.dumps(result, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )
    return result
