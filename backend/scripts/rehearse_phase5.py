from __future__ import annotations

import argparse
from datetime import UTC, datetime
import os
from pathlib import Path
import sys
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, KnowledgeVersion, User
from app.services.phase5_migration import migrate_database, write_report


def _sqlite_url(path: Path) -> str:
    return f"sqlite+pysqlite:///{path.resolve()}"


def _connect_args(database_url: str) -> dict[str, object]:
    return {"check_same_thread": False} if database_url.startswith("sqlite") else {}


def _seed(database_url: str) -> None:
    engine = create_engine(database_url, connect_args=_connect_args(database_url))
    Base.metadata.create_all(engine)
    created_at = datetime(2026, 8, 6, 1, 2, 3, tzinfo=UTC)
    with Session(engine) as session:
        session.add_all(
            [
                User(
                    id="rehearsal-admin",
                    email="rehearsal-admin@example.test",
                    name="演练管理员",
                    role="admin",
                    is_active=True,
                    created_at=created_at,
                    updated_at=created_at,
                ),
                KnowledgeVersion(
                    id="rehearsal-knowledge",
                    version_hash="r" * 64,
                    label="Phase5 演练知识",
                    source_root="fixture://phase5-rehearsal",
                    coverage={"question_count": 0},
                    status="published",
                    is_active=True,
                    created_at=created_at,
                    updated_at=created_at,
                ),
            ]
        )
        session.commit()
    engine.dispose()


def run_rehearsal(
    root: Path,
    url_pairs: list[tuple[str, str]] | None = None,
) -> dict[str, Any]:
    root.mkdir(parents=True, exist_ok=True)
    summaries: list[dict[str, Any]] = []
    pairs = url_pairs
    if pairs is None:
        pairs = []
        for index in (1, 2):
            run_dir = root / f"run-{index}"
            run_dir.mkdir(parents=True, exist_ok=True)
            source_path = run_dir / "source.db"
            target_path = run_dir / "target.db"
            for path in (source_path, target_path):
                if path.exists():
                    path.unlink()
            pairs.append((_sqlite_url(source_path), _sqlite_url(target_path)))
    for index, (source_url, target_url) in enumerate(pairs, start=1):
        run_dir = root / f"run-{index}"
        run_dir.mkdir(parents=True, exist_ok=True)
        _seed(source_url)
        target_engine = create_engine(target_url, connect_args=_connect_args(target_url))
        Base.metadata.create_all(target_engine)
        target_engine.dispose()
        result = migrate_database(source_url, target_url)
        summaries.append(
            {
                "source_hash": result["source"]["hash"],
                "target_hash": result["target"]["hash"],
                "row_counts": result["target"]["row_counts"],
                "match": result["match"],
            }
        )
    return {"rehearsal": "phase5", "runs": len(summaries), "match": all(item["match"] for item in summaries), "summaries": summaries}


def main() -> int:
    parser = argparse.ArgumentParser(description="Phase 5 两次隔离迁移演练")
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--report", type=Path)
    for index in (1, 2):
        parser.add_argument(
            f"--source-url-{index}",
            default=os.getenv(f"PHASE5_REHEARSAL_SOURCE_URL_{index}"),
        )
        parser.add_argument(
            f"--target-url-{index}",
            default=os.getenv(f"PHASE5_REHEARSAL_TARGET_URL_{index}"),
        )
    args = parser.parse_args()
    configured_pairs = [
        (getattr(args, f"source_url_{index}"), getattr(args, f"target_url_{index}"))
        for index in (1, 2)
    ]
    if any(source or target for source, target in configured_pairs):
        if any(not source or not target for source, target in configured_pairs):
            parser.error("两次 MySQL 演练必须同时提供 source/target URL")
        report = run_rehearsal(args.root, [(source, target) for source, target in configured_pairs])
    else:
        report = run_rehearsal(args.root)
    if args.report:
        write_report(report, args.report)
    print(report)
    return 0 if report["match"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
