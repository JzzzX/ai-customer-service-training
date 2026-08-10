import { z } from "zod";

export const sourceKindSchema = z.enum(["markdown", "excel", "mindmap"]);

export const sourceLocatorSchema = z.object({
  sourcePath: z.string().trim().min(1),
  kind: sourceKindSchema,
  anchor: z.string().trim().min(1),
  line: z.number().int().positive().optional(),
  sheet: z.string().trim().min(1).optional(),
  row: z.number().int().positive().optional(),
  nodeId: z.string().trim().min(1).optional(),
  path: z.array(z.string().trim().min(1)),
});

export const knowledgeUnitSchema = z.object({
  id: z.string().regex(/^ku_[a-f0-9]{24}$/),
  title: z.string().trim().min(1),
  content: z.string().trim().min(1),
  categoryPath: z.array(z.string().trim().min(1)),
  semanticKey: z.string().trim().min(1).optional(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  sources: z.array(sourceLocatorSchema).min(1),
});

export type SourceKind = z.infer<typeof sourceKindSchema>;
export type SourceLocator = z.infer<typeof sourceLocatorSchema>;
export type KnowledgeUnit = z.infer<typeof knowledgeUnitSchema>;

export interface RawKnowledgeUnit {
  title: string;
  content: string;
  categoryPath: string[];
  semanticKey?: string;
  source: SourceLocator;
}

export interface ParseIssue {
  code:
    | "empty_item"
    | "empty_answer"
    | "empty_sheet"
    | "duplicate"
    | "conflict"
    | "parse_error";
  severity: "info" | "warning" | "error";
  message: string;
  sources: SourceLocator[];
}

export interface SourceManifest {
  sourcePath: string;
  kind: SourceKind;
  sourceHash: string;
  bytes: number;
  stats: Record<string, number>;
}

export interface CoverageMetrics {
  sourceFiles: number;
  markdownFiles: number;
  workbookFiles: number;
  mindmapFiles: number;
  workbookSheets: number;
  spreadsheetRows: number;
  mindmapNodes: number;
  mindmapUrls: number;
  markdownImages: number;
  workbookImages: number;
  skippedImages: number;
  unitsBeforeDedup: number;
  unitsAfterDedup: number;
  duplicatesMerged: number;
  conflicts: number;
  emptyItemsSkipped: number;
  parseErrors: number;
}

export type ExpectedCoverage = Partial<
  Pick<
    CoverageMetrics,
    | "sourceFiles"
    | "markdownFiles"
    | "workbookFiles"
    | "mindmapFiles"
    | "workbookSheets"
    | "mindmapNodes"
    | "skippedImages"
  >
>;

export interface CoverageCheck {
  name: keyof ExpectedCoverage | "parseErrors";
  expected: number;
  actual: number;
  passed: boolean;
}

export interface KnowledgePack {
  schemaVersion: 1;
  packHash: string;
  sourceRoot: string;
  sources: SourceManifest[];
  units: KnowledgeUnit[];
  issues: ParseIssue[];
  coverage: CoverageMetrics;
  gate: {
    passed: boolean;
    checks: CoverageCheck[];
  };
}

export const parseIssueSchema = z.object({
  code: z.enum([
    "empty_item",
    "empty_answer",
    "empty_sheet",
    "duplicate",
    "conflict",
    "parse_error",
  ]),
  severity: z.enum(["info", "warning", "error"]),
  message: z.string().trim().min(1),
  sources: z.array(sourceLocatorSchema).min(1),
});

export const sourceManifestSchema = z.object({
  sourcePath: z.string().trim().min(1),
  kind: sourceKindSchema,
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().nonnegative(),
  stats: z.record(z.string(), z.number().nonnegative()),
});

export const coverageMetricsSchema = z.object({
  sourceFiles: z.number().int().nonnegative(),
  markdownFiles: z.number().int().nonnegative(),
  workbookFiles: z.number().int().nonnegative(),
  mindmapFiles: z.number().int().nonnegative(),
  workbookSheets: z.number().int().nonnegative(),
  spreadsheetRows: z.number().int().nonnegative(),
  mindmapNodes: z.number().int().nonnegative(),
  mindmapUrls: z.number().int().nonnegative(),
  markdownImages: z.number().int().nonnegative(),
  workbookImages: z.number().int().nonnegative(),
  skippedImages: z.number().int().nonnegative(),
  unitsBeforeDedup: z.number().int().nonnegative(),
  unitsAfterDedup: z.number().int().nonnegative(),
  duplicatesMerged: z.number().int().nonnegative(),
  conflicts: z.number().int().nonnegative(),
  emptyItemsSkipped: z.number().int().nonnegative(),
  parseErrors: z.number().int().nonnegative(),
});

export const coverageCheckSchema = z.object({
  name: z.enum([
    "sourceFiles",
    "markdownFiles",
    "workbookFiles",
    "mindmapFiles",
    "workbookSheets",
    "mindmapNodes",
    "skippedImages",
    "parseErrors",
  ]),
  expected: z.number().int().nonnegative(),
  actual: z.number().int().nonnegative(),
  passed: z.boolean(),
});

export const knowledgePackSchema: z.ZodType<KnowledgePack> = z.object({
  schemaVersion: z.literal(1),
  packHash: z.string().regex(/^[a-f0-9]{64}$/),
  sourceRoot: z.string().trim().min(1),
  sources: z.array(sourceManifestSchema),
  units: z.array(knowledgeUnitSchema),
  issues: z.array(parseIssueSchema),
  coverage: coverageMetricsSchema,
  gate: z.object({
    passed: z.boolean(),
    checks: z.array(coverageCheckSchema),
  }),
});
