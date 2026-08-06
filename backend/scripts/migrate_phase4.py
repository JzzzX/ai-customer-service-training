#!/usr/bin/env python3
"""Import canonical Phase 4 scenario data into the configured database."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.core.database import get_database
from app.services.phase4_migration import migrate_phase4


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("payload", type=Path)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    payloads = json.loads(args.payload.read_text(encoding="utf-8"))
    database = get_database()
    with database.session_scope() as session:
        report = migrate_phase4(session, payloads)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
