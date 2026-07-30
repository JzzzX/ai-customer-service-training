import { and, count, eq } from "drizzle-orm";

import type { DatabaseClient } from "../client";
import {
  knowledgeSources,
  knowledgeUnits,
  knowledgeVersions,
  questions,
  quizSets,
  scenarioVersions,
} from "../schema";
import type {
  KnowledgeHealth,
  KnowledgeQueryStore,
} from "@/lib/knowledge/query-store";

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
}
