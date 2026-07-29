import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";

import { parseExcelBuffer } from "./adapters/excel";
import { parseMarkdownSource } from "./adapters/markdown";
import { parseMindmapSource } from "./adapters/mindmap";
import { finalizeRawUnits, hashText } from "./compiler";
import type {
  CoverageCheck,
  CoverageMetrics,
  ExpectedCoverage,
  KnowledgePack,
  ParseIssue,
  RawKnowledgeUnit,
  SourceKind,
  SourceManifest,
} from "./schema";

interface CompileKnowledgeDirectoryInput {
  sourceDir: string;
  expected?: ExpectedCoverage;
}

export async function compileKnowledgeDirectory(
  input: CompileKnowledgeDirectoryInput,
): Promise<KnowledgePack> {
  const sourceDir = resolve(input.sourceDir);
  const entries = (await readdir(sourceDir, { withFileTypes: true }))
    .filter(
      (entry) =>
        entry.isFile() &&
        !entry.name.startsWith(".~") &&
        SUPPORTED_EXTENSIONS.has(normalizedExtension(entry.name)),
    )
    .sort((left, right) => left.name.localeCompare(right.name));
  const rawUnits: RawKnowledgeUnit[] = [];
  const parseIssues: ParseIssue[] = [];
  const sources: SourceManifest[] = [];
  const coverage = emptyCoverage();

  for (const entry of entries) {
    const absolutePath = join(sourceDir, entry.name);
    const extension = normalizedExtension(entry.name);
    const kind = kindForExtension(extension);
    const [buffer, fileStat] = await Promise.all([
      readFile(absolutePath),
      stat(absolutePath),
    ]);
    const manifest: SourceManifest = {
      sourcePath: entry.name,
      kind,
      sourceHash: createHash("sha256").update(buffer).digest("hex"),
      bytes: fileStat.size,
      stats: {},
    };

    coverage.sourceFiles += 1;
    incrementFileCount(coverage, kind);

    try {
      if (kind === "markdown") {
        const parsed = parseMarkdownSource({
          sourcePath: entry.name,
          text: buffer.toString("utf8"),
        });
        rawUnits.push(...parsed.units);
        parseIssues.push(...parsed.issues);
        manifest.stats = parsed.stats;
        coverage.markdownImages += parsed.stats.skippedImages;
        coverage.emptyItemsSkipped += parsed.stats.emptyItemsSkipped;
      } else if (kind === "mindmap") {
        const parsed = parseMindmapSource({
          sourcePath: entry.name,
          text: buffer.toString("utf8"),
        });
        rawUnits.push(...parsed.units);
        parseIssues.push(...parsed.issues);
        manifest.stats = parsed.stats;
        coverage.mindmapNodes += parsed.stats.nodesSeen;
        coverage.mindmapUrls += parsed.stats.urlReferences;
        coverage.emptyItemsSkipped += parsed.stats.emptyItemsSkipped;
      } else {
        const parsed = await parseExcelBuffer({
          sourcePath: entry.name,
          buffer,
        });
        rawUnits.push(...parsed.units);
        parseIssues.push(...parsed.issues);
        manifest.stats = parsed.stats;
        coverage.workbookSheets += parsed.stats.sheetsSeen;
        coverage.spreadsheetRows += parsed.stats.rowsSeen;
        coverage.workbookImages += parsed.stats.skippedImages;
        coverage.emptyItemsSkipped += parsed.stats.emptyItemsSkipped;
      }
    } catch (error) {
      parseIssues.push({
        code: "parse_error",
        severity: "error",
        message: `Could not parse "${entry.name}": ${readErrorMessage(error)}`,
        sources: [
          {
            sourcePath: entry.name,
            kind,
            anchor: `file:${entry.name}`,
            path: [entry.name],
          },
        ],
      });
    }

    sources.push(manifest);
  }

  const finalized = finalizeRawUnits(rawUnits);
  const issues = [...parseIssues, ...finalized.issues];
  coverage.skippedImages =
    coverage.markdownImages + coverage.workbookImages;
  coverage.unitsBeforeDedup = rawUnits.length;
  coverage.unitsAfterDedup = finalized.units.length;
  coverage.duplicatesMerged = finalized.duplicatesMerged;
  coverage.conflicts = finalized.conflicts;
  coverage.parseErrors = issues.filter(
    (issue) => issue.code === "parse_error",
  ).length;

  const checks = buildCoverageChecks(coverage, input.expected ?? {});
  const packHash = hashText(
    stableStringify({
      schemaVersion: 1,
      sources,
      units: finalized.units,
    }),
  );

  return {
    schemaVersion: 1,
    packHash,
    sourceRoot: basename(sourceDir),
    sources,
    units: finalized.units,
    issues,
    coverage,
    gate: {
      passed: checks.every((check) => check.passed),
      checks,
    },
  };
}

const SUPPORTED_EXTENSIONS = new Set([".md", ".xlsx", ".mm"]);

function normalizedExtension(fileName: string): string {
  return extname(fileName).replace(/\s+/g, "");
}

function kindForExtension(extension: string): SourceKind {
  if (extension === ".md") {
    return "markdown";
  }

  if (extension === ".xlsx") {
    return "excel";
  }

  return "mindmap";
}

function incrementFileCount(
  coverage: CoverageMetrics,
  kind: SourceKind,
): void {
  if (kind === "markdown") {
    coverage.markdownFiles += 1;
  } else if (kind === "excel") {
    coverage.workbookFiles += 1;
  } else {
    coverage.mindmapFiles += 1;
  }
}

function emptyCoverage(): CoverageMetrics {
  return {
    sourceFiles: 0,
    markdownFiles: 0,
    workbookFiles: 0,
    mindmapFiles: 0,
    workbookSheets: 0,
    spreadsheetRows: 0,
    mindmapNodes: 0,
    mindmapUrls: 0,
    markdownImages: 0,
    workbookImages: 0,
    skippedImages: 0,
    unitsBeforeDedup: 0,
    unitsAfterDedup: 0,
    duplicatesMerged: 0,
    conflicts: 0,
    emptyItemsSkipped: 0,
    parseErrors: 0,
  };
}

function buildCoverageChecks(
  coverage: CoverageMetrics,
  expected: ExpectedCoverage,
): CoverageCheck[] {
  const checks: CoverageCheck[] = Object.entries(expected).map(
    ([name, expectedValue]) => {
      const metricName = name as keyof ExpectedCoverage;
      const actual = coverage[metricName];

      return {
        name: metricName,
        expected: expectedValue as number,
        actual,
        passed: actual === expectedValue,
      };
    },
  );

  checks.push({
    name: "parseErrors",
    expected: 0,
    actual: coverage.parseErrors,
    passed: coverage.parseErrors === 0,
  });

  return checks;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortObjectKeys(value));
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortObjectKeys(child)]),
    );
  }

  return value;
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
