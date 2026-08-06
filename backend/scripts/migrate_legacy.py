from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.legacy_migration import (
    export_legacy_snapshot,
    import_legacy_snapshot,
    reconcile_legacy_manifest,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Migrate legacy PostgreSQL data into company MySQL")
    subparsers = parser.add_subparsers(dest="command", required=True)

    export_parser = subparsers.add_parser("export")
    export_parser.add_argument("--output", type=Path, required=True)
    export_parser.add_argument("--manifest", type=Path, required=True)
    export_parser.add_argument("--source-commit", default=None)

    import_parser = subparsers.add_parser("import")
    import_parser.add_argument("--input", type=Path, required=True)
    import_parser.add_argument("--report", type=Path, required=True)
    import_parser.add_argument("--replace-empty-target", action="store_true")
    import_parser.add_argument(
        "--target-name",
        help="required with --replace-empty-target; must match the target database name",
    )
    import_parser.add_argument(
        "--topic-fixture",
        type=Path,
        help="versioned static topic question fixture required when topic attempts exist",
    )

    reconcile_parser = subparsers.add_parser("reconcile")
    reconcile_parser.add_argument("--manifest", type=Path, required=True)
    reconcile_parser.add_argument("--report", type=Path, required=True)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.command == "export":
        source_url = os.environ.get("LEGACY_DATABASE_URL")
        if not source_url:
            raise SystemExit("LEGACY_DATABASE_URL is required for export")
        result = export_legacy_snapshot(
            source_url,
            args.output,
            args.manifest,
            source_commit=args.source_commit,
        )
    elif args.command == "import":
        target_url = os.environ.get("DATABASE_URL")
        if not target_url:
            raise SystemExit("DATABASE_URL is required for import")
        result = import_legacy_snapshot(
            args.input,
            target_url,
            args.report,
            replace_empty_target=args.replace_empty_target,
            target_name=args.target_name,
            topic_fixture=args.topic_fixture,
        )
    else:
        result = reconcile_legacy_manifest(args.manifest, args.report)
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
