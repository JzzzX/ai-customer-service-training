import { createHash } from "node:crypto";

import { and, asc, count, eq } from "drizzle-orm";

import type { DatabaseClient } from "../client";
import {
  knowledgeSources,
  knowledgeUnits,
  knowledgeVersions,
  questions,
  quizSets,
  scenarioVersions,
} from "../schema";
import { selectKnowledgeUnitsForCategory } from "@/lib/scenario/knowledge-matching";
import type { ScenarioCategory } from "@/lib/scenario/schema";
import { knowledgeUnitSchema, type KnowledgeUnit } from "@/lib/knowledge/schema";
import type {
  KnowledgeHealth,
  KnowledgeQueryStore,
} from "@/lib/knowledge/query-store";

const SCENARIO_UNIT_CACHE_TTL_MS = 5 * 60 * 1000;

type CachedScenarioUnits = {
  units: KnowledgeUnit[];
  versionId: string;
  expireAt: number;
};

const scenarioUnitCache = new Map<ScenarioCategory, CachedScenarioUnits>();

export class DbKnowledgeQueryStore implements KnowledgeQueryStore {
  constructor(private readonly database: DatabaseClient) {}

  async loadActiveHealth(): Promise<KnowledgeHealth | null> {
    const [version] = await this.database
      .select({
        id: knowledgeVersions.id,
        versionHash: knowledgeVersions.versionHash,
        sourceRoot: knowledgeVersions.sourceRoot,
        status: knowledgeVersions.status,
        createdAt: knowledgeVersions.createdAt,
      })
      .from(knowledgeVersions)
      .where(eq(knowledgeVersions.isActive, true))
      .limit(1);
    if (!version) {
      return null;
    }

    const [
      [sourceSummary],
      [unitSummary],
      [conflictSummary],
      [questionSummary],
      [quizSummary],
      [scenarioSummary],
    ] = await Promise.all([
      this.database
        .select({ value: count() })
        .from(knowledgeSources)
        .where(
          eq(knowledgeSources.knowledgeVersionId, version.id),
        ),
      this.database
        .select({ value: count() })
        .from(knowledgeUnits)
        .where(eq(knowledgeUnits.knowledgeVersionId, version.id)),
      this.database
        .select({ value: count() })
        .from(knowledgeUnits)
        .where(
          and(
            eq(knowledgeUnits.knowledgeVersionId, version.id),
            eq(knowledgeUnits.hasConflict, true),
          ),
        ),
      this.database
        .select({ value: count() })
        .from(questions)
        .where(eq(questions.knowledgeVersionId, version.id)),
      this.database
        .select({ value: count() })
        .from(quizSets)
        .where(
          and(
            eq(quizSets.knowledgeVersionId, version.id),
            eq(quizSets.status, "published"),
          ),
        ),
      this.database
        .select({ value: count() })
        .from(scenarioVersions)
        .where(
          and(
            eq(scenarioVersions.knowledgeVersionId, version.id),
            eq(scenarioVersions.status, "published"),
          ),
        ),
    ]);

    return {
      versionId: version.id,
      versionHash: version.versionHash,
      sourceRoot: version.sourceRoot,
      status: version.status,
      createdAt: version.createdAt.toISOString(),
      sourceCount: sourceSummary?.value ?? 0,
      unitCount: unitSummary?.value ?? 0,
      conflictCount: conflictSummary?.value ?? 0,
      questionCount: questionSummary?.value ?? 0,
      publishedQuizCount: quizSummary?.value ?? 0,
      publishedScenarioCount: scenarioSummary?.value ?? 0,
    };
  }

  async listUnitsForScenario(
    category: ScenarioCategory,
    limit = 5,
  ): Promise<KnowledgeUnit[]> {
    const now = Date.now();
    const cached = scenarioUnitCache.get(category);
    if (cached && cached.expireAt > now) {
      return selectKnowledgeUnitsForCategory(cached.units, category, limit);
    }

    const [version] = await this.database
      .select({ id: knowledgeVersions.id })
      .from(knowledgeVersions)
      .where(eq(knowledgeVersions.isActive, true))
      .limit(1);
    if (!version) {
      return [];
    }
    const rows = await this.database
      .select({
        unitKey: knowledgeUnits.unitKey,
        title: knowledgeUnits.title,
        content: knowledgeUnits.content,
        categoryPath: knowledgeUnits.categoryPath,
        semanticKey: knowledgeUnits.semanticKey,
        contentHash: knowledgeUnits.contentHash,
        sources: knowledgeUnits.sources,
      })
      .from(knowledgeUnits)
      .where(
        and(
          eq(knowledgeUnits.knowledgeVersionId, version.id),
          eq(knowledgeUnits.canUseForScenario, true),
        ),
      )
      .orderBy(asc(knowledgeUnits.title))
      .limit(50);
    const units = rows.map((row) =>
      knowledgeUnitSchema.parse({
        id: toUnitId(row.unitKey),
        title: row.title,
        content: row.content,
        categoryPath: row.categoryPath,
        semanticKey: row.semanticKey ?? undefined,
        contentHash: row.contentHash,
        sources: row.sources,
      }),
    );
    scenarioUnitCache.set(category, {
      units,
      versionId: version.id,
      expireAt: now + SCENARIO_UNIT_CACHE_TTL_MS,
    });
    return selectKnowledgeUnitsForCategory(units, category, limit);
  }
}

function toUnitId(unitKey: string): string {
  const hash = createHash("sha256").update(unitKey).digest("hex");
  return `ku_${hash.slice(0, 24)}`;
}
