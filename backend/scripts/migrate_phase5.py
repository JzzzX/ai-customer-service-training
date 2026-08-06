from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.phase5_migration import MigrationError, migrate_database, write_report


def main() -> int:
    parser = argparse.ArgumentParser(description="Phase 5 全量数据迁移与对账")
    parser.add_argument("--source-url", required=True)
    parser.add_argument("--target-url", required=True)
    parser.add_argument("--report", required=True)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--replace-target", action="store_true")
    args = parser.parse_args()
    try:
        report = migrate_database(
            args.source_url,
            args.target_url,
            dry_run=args.dry_run,
            replace_target=args.replace_target,
        )
    except MigrationError as error:
        print(f"迁移停止：{error}", file=sys.stderr)
        return 2
    write_report(report, args.report)
    print(json.dumps(report, ensure_ascii=False, sort_keys=True))
    return 0 if report["match"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
