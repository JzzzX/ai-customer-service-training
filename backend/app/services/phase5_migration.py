from __future__ import annotations

from collections.abc import Iterable
from datetime import date, datetime
from decimal import Decimal
import hashlib
import json
from pathlib import Path
from typing import Any

from sqlalchemy import Engine, create_engine, select
from sqlalchemy.engine import Connection
from sqlalchemy.orm import Session

from app.models import Base


TABLE_ORDER = (
    "users",
    "feishu_identities",
    "knowledge_versions",
    "knowledge_sources",
    "knowledge_units",
    "quiz_sets",
    "questions",
    "quiz_set_questions",
    "quiz_attempts",
    "quiz_answers",
    "assignments",
    "knowledge_progress",
    "scenario_progress_summaries",
    "scenarios",
    "scenario_versions",
    "training_sessions",
    "training_messages",
    "evaluation_reports",
    "review_decisions",
    "admin_audit_events",
)


class MigrationError(RuntimeError):
    """Raised when a migration cannot prove a safe, complete copy."""


def _tables() -> list[Any]:
    missing = [name for name in TABLE_ORDER if name not in Base.metadata.tables]
    if missing:
        raise MigrationError(f"missing migration tables: {', '.join(missing)}")
    return [Base.metadata.tables[name] for name in TABLE_ORDER]


def _bind_execute(bind: Session | Connection, statement: Any):
    return bind.execute(statement)


def _canonical(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, bytes):
        return value.hex()
    if isinstance(value, dict):
        return {str(key): _canonical(item) for key, item in sorted(value.items(), key=lambda item: str(item[0]))}
    if isinstance(value, (list, tuple)):
        return [_canonical(item) for item in value]
    if isinstance(value, set):
        return sorted(_canonical(item) for item in value)
    return value


def _table_rows(bind: Session | Connection, table: Any) -> list[dict[str, Any]]:
    columns = list(table.primary_key.columns)
    statement = select(table)
    if columns:
        statement = statement.order_by(*columns)
    rows = _bind_execute(bind, statement).mappings().all()
    return [
        {column.name: _canonical(row[column.name]) for column in table.columns}
        for row in rows
    ]


def _foreign_key_orphans(bind: Session | Connection, tables: Iterable[Any]) -> list[dict[str, Any]]:
    orphans: list[dict[str, Any]] = []
    for table in tables:
        for foreign_key in table.foreign_keys:
            local_column = foreign_key.parent
            target_column = foreign_key.column
            target_values = {
                row[0] for row in _bind_execute(bind, select(target_column)).all()
            }
            count = sum(
                1
                for row in _bind_execute(bind, select(local_column)).all()
                if row[0] is not None and row[0] not in target_values
            )
            if count:
                orphans.append(
                    {
                        "table": table.name,
                        "column": local_column.name,
                        "referenced_table": target_column.table.name,
                        "referenced_column": target_column.name,
                        "count": count,
                    }
                )
    return sorted(
        orphans,
        key=lambda item: (item["table"], item["column"], item["referenced_table"]),
    )


def _snapshot(bind: Session | Connection) -> dict[str, Any]:
    tables = _tables()
    rows_by_table = {table.name: _table_rows(bind, table) for table in tables}
    canonical_rows = [
        {"table": table.name, "rows": rows_by_table[table.name]}
        for table in tables
    ]
    serialized = json.dumps(
        canonical_rows,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return {
        "tables": [table.name for table in tables],
        "row_counts": {name: len(rows) for name, rows in rows_by_table.items()},
        "foreign_key_orphans": _foreign_key_orphans(bind, tables),
        "hash": hashlib.sha256(serialized).hexdigest(),
    }


def snapshot_database(session: Session) -> dict[str, Any]:
    """Return a deterministic, non-sensitive inventory of all migrated tables."""
    return _snapshot(session)


def _engine(database_url: str) -> Engine:
    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    return create_engine(database_url, pool_pre_ping=True, connect_args=connect_args)


def _is_empty(snapshot: dict[str, Any]) -> bool:
    return all(count == 0 for count in snapshot["row_counts"].values())


def _delete_target(connection: Connection) -> None:
    for table in reversed(_tables()):
        connection.execute(table.delete())


def _copy_rows(source: Connection, target: Connection) -> None:
    for table in _tables():
        for row in source.execute(select(table)).mappings():
            target.execute(table.insert().values(**dict(row)))


def migrate_database(
    source_url: str,
    target_url: str,
    *,
    dry_run: bool = False,
    replace_target: bool = False,
) -> dict[str, Any]:
    """Copy a source schema into an isolated target and prove hash equality."""
    source_engine = _engine(source_url)
    target_engine = _engine(target_url)
    try:
        with source_engine.connect() as source_connection:
            source_snapshot = _snapshot(source_connection)
        with target_engine.connect() as target_connection:
            target_before = _snapshot(target_connection)

        if not _is_empty(target_before) and not replace_target:
            raise MigrationError("target database is not empty; pass replace_target explicitly")

        if not dry_run:
            with source_engine.connect() as source_connection, target_engine.begin() as target_connection:
                if replace_target:
                    _delete_target(target_connection)
                _copy_rows(source_connection, target_connection)

        with target_engine.connect() as target_connection:
            target_snapshot = _snapshot(target_connection)
        match = (
            source_snapshot["hash"] == target_snapshot["hash"]
            and source_snapshot["row_counts"] == target_snapshot["row_counts"]
            and not source_snapshot["foreign_key_orphans"]
            and not target_snapshot["foreign_key_orphans"]
        )
        return {
            "dry_run": dry_run,
            "source": source_snapshot,
            "target_before": target_before,
            "target": target_snapshot,
            "match": match,
        }
    finally:
        source_engine.dispose()
        target_engine.dispose()


def write_report(report: dict[str, Any], output: str | Path) -> None:
    Path(output).write_text(
        json.dumps(report, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )
