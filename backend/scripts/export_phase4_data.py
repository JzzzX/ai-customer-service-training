#!/usr/bin/env python3
"""Write the checked-in legacy scenario templates as canonical Phase 4 JSON."""

from __future__ import annotations

import argparse
from pathlib import Path
import json
import sys


DEFAULT_INPUT = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "phase4-export.json"


def canonical_payload(path: Path) -> list[dict[str, object]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, list) or len(payload) != 8:
        raise ValueError("Phase 4 canonical export must contain exactly eight scenarios")
    return sorted(payload, key=lambda item: str(item["scenario_key"]))


def format_payload(payload: list[dict[str, object]]) -> str:
    return json.dumps(payload, ensure_ascii=False, indent=2) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args(argv)

    rendered = format_payload(canonical_payload(args.input))
    if args.check:
        if not args.output.exists() or args.output.read_text(encoding="utf-8") != rendered:
            print(f"canonical export differs: {args.output}", file=sys.stderr)
            return 1
        print(f"canonical export ok: {args.output}")
        return 0
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(rendered, encoding="utf-8")
    print(f"exported 8 scenarios to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
