import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path
from tempfile import TemporaryDirectory

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import get_database
from app.models import Base
from app.services.phase3_migration import (
    migrate_phase3_export,
    reconcile_phase3_export,
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Import the Phase 3 legacy quiz export and reconcile it."
    )
    parser.add_argument("payload", type=Path)
    parser.add_argument(
        "--rehearsals",
        type=int,
        default=1,
        help="Run isolated SQLite rehearsals instead of writing the configured database.",
    )
    arguments = parser.parse_args()
    if arguments.rehearsals < 1:
        parser.error("--rehearsals must be at least 1")
    payload = json.loads(arguments.payload.read_text(encoding="utf-8"))
    if arguments.rehearsals == 1:
        reports = [_run_configured(payload)]
    else:
        reports = _run_rehearsals(payload, arguments.rehearsals)
    output = {
        "passed": all(report["reconciliation"]["passed"] for report in reports),
        "rehearsals": reports,
    }
    print(json.dumps(output, ensure_ascii=False))
    return 0 if output["passed"] else 2


def _run_configured(payload: dict[str, object]) -> dict[str, object]:
    with get_database().session_scope() as session:
        migration = migrate_phase3_export(session, payload)
        report = reconcile_phase3_export(session, payload)
    return {"migration": asdict(migration), "reconciliation": asdict(report)}


def _run_rehearsals(
    payload: dict[str, object], count: int
) -> list[dict[str, object]]:
    results: list[dict[str, object]] = []
    with TemporaryDirectory(prefix="phase3-rehearsal-") as directory:
        for index in range(count):
            database_path = Path(directory) / f"rehearsal-{index}.db"
            engine = create_engine(f"sqlite+pysqlite:///{database_path}")
            Base.metadata.create_all(engine)
            sessions = sessionmaker(bind=engine, expire_on_commit=False)
            with sessions() as session:
                migration = migrate_phase3_export(session, payload)
                session.commit()
                report = reconcile_phase3_export(session, payload)
            results.append(
                {
                    "migration": asdict(migration),
                    "reconciliation": asdict(report),
                }
            )
            engine.dispose()
    return results


if __name__ == "__main__":
    raise SystemExit(main())
