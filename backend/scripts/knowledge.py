import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import get_database
from app.services.knowledge.compiler import compile_knowledge_sources
from app.services.knowledge.publication import KnowledgePublicationService
from app.services.knowledge.schema import KnowledgePack, SourceInput

_SOURCE_KINDS = {
    ".md": "markdown",
    ".markdown": "markdown",
    ".xlsx": "excel",
    ".mm": "mindmap",
}


def main() -> int:
    parser = argparse.ArgumentParser(description="Compile and publish knowledge packs.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    compile_parser = subparsers.add_parser("compile")
    compile_parser.add_argument("source_dir", type=Path)
    compile_parser.add_argument("output", type=Path)
    publish_parser = subparsers.add_parser("publish")
    publish_parser.add_argument("pack", type=Path)
    publish_parser.add_argument("--label", required=True)
    arguments = parser.parse_args()

    if arguments.command == "compile":
        return compile_command(arguments.source_dir, arguments.output)
    return publish_command(arguments.pack, arguments.label)


def compile_command(source_dir: Path, output: Path) -> int:
    root = source_dir.resolve()
    sources = [
        SourceInput(
            source_path=path.relative_to(root).as_posix(),
            kind=_SOURCE_KINDS[path.suffix.lower()],
            content=path.read_bytes(),
        )
        for path in sorted(root.rglob("*"))
        if path.is_file() and path.suffix.lower() in _SOURCE_KINDS
    ]
    pack = compile_knowledge_sources(sources, source_root=str(root))
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(pack.model_dump(mode="json"), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "pack_hash": pack.pack_hash,
                "source_count": pack.coverage["source_files"],
                "unit_count": pack.coverage["units_after_dedup"],
                "conflict_count": pack.coverage["conflicts"],
                "gate_passed": pack.gate.passed,
            },
            ensure_ascii=False,
        )
    )
    return 0 if pack.gate.passed else 2


def publish_command(pack_path: Path, label: str) -> int:
    pack = KnowledgePack.model_validate_json(pack_path.read_text(encoding="utf-8"))
    with get_database().session_scope() as session:
        result = KnowledgePublicationService(session).publish(pack, label=label)
    print(json.dumps(asdict(result), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
