import { knowledgePackSchema } from "@/lib/knowledge/schema";
import type {
  KnowledgePack,
  SourceLocator,
} from "@/lib/knowledge/schema";

export interface PublishedKnowledgeVersion {
  id: string;
  versionHash: string;
}

export interface PreparedKnowledgePublication {
  version: {
    versionHash: string;
    schemaVersion: number;
    sourceRoot: string;
    coverage: Record<string, number>;
  };
  sources: Array<{
    sourcePath: string;
    kind: "markdown" | "excel" | "mindmap";
    sourceHash: string;
    bytes: number;
    stats: Record<string, number>;
  }>;
  units: Array<{
    unitKey: string;
    title: string;
    content: string;
    categoryPath: string[];
    semanticKey?: string;
    contentHash: string;
    sources: SourceLocator[];
    hasConflict: boolean;
    canUseForQuiz: boolean;
    canUseForScenario: boolean;
    canUseForEvaluation: boolean;
  }>;
}

export interface KnowledgePackStore {
  findVersionByHash(
    versionHash: string,
  ): Promise<PublishedKnowledgeVersion | null | undefined>;
  publishAtomically(
    publication: PreparedKnowledgePublication,
  ): Promise<PublishedKnowledgeVersion>;
}

export async function publishKnowledgePackToStore(
  input: KnowledgePack,
  store: KnowledgePackStore,
): Promise<PublishedKnowledgeVersion & { created: boolean }> {
  const pack = knowledgePackSchema.parse(input);
  if (!pack.gate.passed) {
    throw new Error(
      "Knowledge pack failed the coverage gate and cannot be published.",
    );
  }

  const existing = await store.findVersionByHash(pack.packHash);
  if (existing) {
    return { ...existing, created: false };
  }

  const published = await store.publishAtomically(
    prepareKnowledgePublication(pack),
  );
  return { ...published, created: true };
}

export function prepareKnowledgePublication(
  input: KnowledgePack,
): PreparedKnowledgePublication {
  const pack = knowledgePackSchema.parse(input);
  const conflictSources = new Set(
    pack.issues
      .filter((issue) => issue.code === "conflict")
      .flatMap((issue) => issue.sources)
      .map(sourceLocatorKey),
  );

  return {
    version: {
      versionHash: pack.packHash,
      schemaVersion: pack.schemaVersion,
      sourceRoot: pack.sourceRoot,
      coverage: { ...pack.coverage },
    },
    sources: pack.sources.map((source) => ({ ...source })),
    units: pack.units.map((unit) => {
      const hasConflict = unit.sources.some((source) =>
        conflictSources.has(sourceLocatorKey(source)),
      );

      return {
        unitKey: unit.id,
        title: unit.title,
        content: unit.content,
        categoryPath: unit.categoryPath,
        ...(unit.semanticKey ? { semanticKey: unit.semanticKey } : {}),
        contentHash: unit.contentHash,
        sources: unit.sources,
        hasConflict,
        canUseForQuiz: !hasConflict,
        canUseForScenario: !hasConflict,
        canUseForEvaluation: !hasConflict,
      };
    }),
  };
}

function sourceLocatorKey(source: SourceLocator): string {
  return `${source.sourcePath}\u0000${source.anchor}`;
}
