import hashlib
import json

from app.services.knowledge.adapters import parse_excel, parse_markdown, parse_mindmap
from app.services.knowledge.normalize import normalize_knowledge_text
from app.services.knowledge.schema import (
    CoverageCheck,
    CoverageGate,
    KnowledgePack,
    KnowledgeUnitValue,
    ParseIssue,
    ParseResult,
    RawKnowledgeUnit,
    SourceInput,
    SourceLocator,
    SourceManifest,
)


def compile_knowledge_sources(
    sources: list[SourceInput],
    *,
    source_root: str,
    expected: dict[str, int] | None = None,
) -> KnowledgePack:
    manifests: list[SourceManifest] = []
    raw_units: list[RawKnowledgeUnit] = []
    issues: list[ParseIssue] = []
    parsed_by_kind = {"markdown": 0, "excel": 0, "mindmap": 0}
    aggregate_stats: dict[str, int] = {}

    for source in sorted(sources, key=lambda item: item.source_path):
        parsed_by_kind[source.kind] += 1
        result = _parse_source(source)
        raw_units.extend(result.units)
        issues.extend(result.issues)
        for name, value in result.stats.items():
            aggregate_stats[name] = aggregate_stats.get(name, 0) + value
        manifests.append(
            SourceManifest(
                source_path=source.source_path,
                kind=source.kind,
                source_hash=_hash_bytes(source.content),
                bytes=len(source.content),
                stats=result.stats,
            )
        )

    units, generated_issues, duplicates, conflicts = _finalize_units(raw_units)
    issues.extend(generated_issues)
    issues.sort(key=lambda issue: (issue.code, _locator_key(issue.sources[0])))
    coverage = {
        "source_files": len(sources),
        "markdown_files": parsed_by_kind["markdown"],
        "workbook_files": parsed_by_kind["excel"],
        "mindmap_files": parsed_by_kind["mindmap"],
        "workbook_sheets": aggregate_stats.get("sheets_seen", 0),
        "spreadsheet_rows": aggregate_stats.get("rows_seen", 0),
        "mindmap_nodes": aggregate_stats.get("nodes_seen", 0),
        "skipped_images": aggregate_stats.get("skipped_images", 0),
        "units_before_dedup": len(raw_units),
        "units_after_dedup": len(units),
        "duplicates_merged": duplicates,
        "conflicts": conflicts,
        "empty_items_skipped": aggregate_stats.get("empty_items_skipped", 0),
        "parse_errors": sum(issue.code == "parse_error" for issue in issues),
    }
    checks = [
        CoverageCheck(
            name=name,
            expected=value,
            actual=coverage.get(name, 0),
            passed=coverage.get(name, 0) == value,
        )
        for name, value in (expected or {}).items()
    ]
    if not any(check.name == "parse_errors" for check in checks):
        checks.append(
            CoverageCheck(
                name="parse_errors",
                expected=0,
                actual=coverage["parse_errors"],
                passed=coverage["parse_errors"] == 0,
            )
        )
    pack = KnowledgePack(
        pack_hash="0" * 64,
        source_root=normalize_knowledge_text(source_root),
        sources=manifests,
        units=units,
        issues=issues,
        coverage=coverage,
        gate=CoverageGate(passed=all(check.passed for check in checks), checks=checks),
    )
    canonical = json.dumps(
        pack.model_dump(mode="json", exclude={"pack_hash"}),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return pack.model_copy(update={"pack_hash": _hash_bytes(canonical)})


def _parse_source(source: SourceInput) -> ParseResult:
    try:
        if source.kind == "markdown":
            return parse_markdown(source.source_path, source.content.decode("utf-8"))
        if source.kind == "excel":
            return parse_excel(source.source_path, source.content)
        return parse_mindmap(source.source_path, source.content.decode("utf-8"))
    except Exception as error:
        locator = SourceLocator(
            source_path=source.source_path,
            kind=source.kind,
            anchor="source",
            path=[],
        )
        return ParseResult(
            issues=[
                ParseIssue(
                    code="parse_error",
                    severity="error",
                    message=f"Failed to parse {source.source_path}: {error}",
                    sources=[locator],
                )
            ],
            stats={"parse_errors": 1},
        )


def _finalize_units(
    raw_units: list[RawKnowledgeUnit],
) -> tuple[list[KnowledgeUnitValue], list[ParseIssue], int, int]:
    normalized = sorted((_normalize_raw(item) for item in raw_units), key=lambda item: _locator_key(item.source))
    by_content: dict[str, KnowledgeUnitValue] = {}
    order: list[str] = []
    for item in normalized:
        content_hash = _hash_bytes(f"{item.title}\n{item.content}".encode("utf-8"))
        existing = by_content.get(content_hash)
        if existing:
            existing.sources.append(item.source)
            existing.sources.sort(key=_locator_key)
            if not existing.semantic_key and item.semantic_key:
                existing.semantic_key = item.semantic_key
            continue
        locator_key = _locator_key(item.source)
        by_content[content_hash] = KnowledgeUnitValue(
            id="ku_" + _hash_bytes(locator_key.encode("utf-8"))[:24],
            title=item.title,
            content=item.content,
            category_path=item.category_path,
            semantic_key=item.semantic_key,
            content_hash=content_hash,
            sources=[item.source],
        )
        order.append(content_hash)
    units = [by_content[content_hash] for content_hash in order]
    duplicate_issues = [
        ParseIssue(
            code="duplicate",
            severity="info",
            message=f'Merged {len(unit.sources)} identical knowledge items for "{unit.title}".',
            sources=unit.sources,
        )
        for unit in units
        if len(unit.sources) > 1
    ]
    semantic_groups: dict[str, list[KnowledgeUnitValue]] = {}
    for unit in units:
        if unit.semantic_key:
            semantic_groups.setdefault(unit.semantic_key, []).append(unit)
    conflict_issues = [
        ParseIssue(
            code="conflict",
            severity="warning",
            message=f'Semantic key "{semantic_key}" has {len(group)} different answers.',
            sources=[source for unit in group for source in unit.sources],
        )
        for semantic_key, group in sorted(semantic_groups.items())
        if len({unit.content_hash for unit in group}) > 1
    ]
    return (
        units,
        [*duplicate_issues, *conflict_issues],
        len(normalized) - len(units),
        len(conflict_issues),
    )


def _normalize_raw(item: RawKnowledgeUnit) -> RawKnowledgeUnit:
    return RawKnowledgeUnit(
        title=normalize_knowledge_text(item.title),
        content=normalize_knowledge_text(item.content),
        category_path=[part for value in item.category_path if (part := normalize_knowledge_text(value))],
        semantic_key=normalize_knowledge_text(item.semantic_key) if item.semantic_key else None,
        source=item.source.model_copy(
            update={
                "source_path": normalize_knowledge_text(item.source.source_path),
                "anchor": normalize_knowledge_text(item.source.anchor),
                "path": [
                    part
                    for value in item.source.path
                    if (part := normalize_knowledge_text(value))
                ],
            }
        ),
    )


def _locator_key(source: SourceLocator) -> str:
    return f"{source.source_path}\0{source.anchor}"


def _hash_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()
