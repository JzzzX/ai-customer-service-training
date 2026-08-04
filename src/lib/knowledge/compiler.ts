import { createHash } from "node:crypto";

import { normalizeKnowledgeText } from "./normalize";
import { knowledgeUnitSchema } from "./schema";
import type {
  KnowledgeUnit,
  ParseIssue,
  RawKnowledgeUnit,
  SourceLocator,
} from "./schema";

interface FinalizedUnits {
  units: KnowledgeUnit[];
  issues: ParseIssue[];
  duplicatesMerged: number;
  conflicts: number;
}

export function finalizeRawUnits(
  rawUnits: RawKnowledgeUnit[],
): FinalizedUnits {
  const normalized = rawUnits
    .map(normalizeRawUnit)
    .sort((left, right) =>
      sourceKey(left.source).localeCompare(sourceKey(right.source)),
    );
  const unitsByContent = new Map<string, KnowledgeUnit>();
  const unitOrder: string[] = [];

  for (const item of normalized) {
    const contentHash = hashText(`${item.title}\n${item.content}`);
    const existing = unitsByContent.get(contentHash);

    if (existing) {
      existing.sources.push(item.source);
      existing.sources.sort((left, right) =>
        sourceKey(left).localeCompare(sourceKey(right)),
      );
      existing.semanticKey ??= item.semanticKey;
      continue;
    }

    const locatorKey = sourceKey(item.source);
    const unit = knowledgeUnitSchema.parse({
      id: `ku_${hashText(locatorKey).slice(0, 24)}`,
      title: item.title,
      content: item.content,
      categoryPath: item.categoryPath,
      ...(item.semanticKey ? { semanticKey: item.semanticKey } : {}),
      contentHash,
      sources: [item.source],
    });

    unitsByContent.set(contentHash, unit);
    unitOrder.push(contentHash);
  }

  const units = unitOrder.map((contentHash) => unitsByContent.get(contentHash)!);
  const duplicateIssues: ParseIssue[] = units
    .filter((unit) => unit.sources.length > 1)
    .map((unit) => ({
      code: "duplicate",
      severity: "info",
      message: `Merged ${unit.sources.length} identical knowledge items for "${unit.title}".`,
      sources: unit.sources,
    }));
  const conflictsByKey = new Map<string, KnowledgeUnit[]>();

  for (const unit of units) {
    if (!unit.semanticKey) {
      continue;
    }

    const group = conflictsByKey.get(unit.semanticKey) ?? [];
    group.push(unit);
    conflictsByKey.set(unit.semanticKey, group);
  }

  const conflictIssues: ParseIssue[] = [...conflictsByKey.entries()]
    .filter(([, group]) => new Set(group.map((unit) => unit.contentHash)).size > 1)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([semanticKey, group]) => ({
      code: "conflict",
      severity: "warning",
      message: `Semantic key "${semanticKey}" has ${group.length} different answers.`,
      sources: group.flatMap((unit) => unit.sources),
    }));

  return {
    units,
    issues: [...duplicateIssues, ...conflictIssues],
    duplicatesMerged: normalized.length - units.length,
    conflicts: conflictIssues.length,
  };
}

function normalizeRawUnit(item: RawKnowledgeUnit): RawKnowledgeUnit {
  return {
    title: normalizeKnowledgeText(item.title),
    content: normalizeKnowledgeText(item.content),
    categoryPath: item.categoryPath
      .map(normalizeKnowledgeText)
      .filter(Boolean),
    ...(item.semanticKey
      ? { semanticKey: normalizeKnowledgeText(item.semanticKey) }
      : {}),
    source: {
      ...item.source,
      sourcePath: normalizeKnowledgeText(item.source.sourcePath),
      anchor: normalizeKnowledgeText(item.source.anchor),
      path: item.source.path.map(normalizeKnowledgeText).filter(Boolean),
    },
  };
}

function sourceKey(source: SourceLocator): string {
  return `${source.sourcePath}\u0000${source.anchor}`;
}

export function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
