import { and, asc, eq } from "drizzle-orm";

import type { DatabaseClient } from "../client";
import { scenarios, scenarioVersions } from "../schema";
import {
  scenarioTemplateSchema,
  scenarioTemplatesSchema,
  type ScenarioTemplate,
} from "@/lib/scenario/schema";
import type { ScenarioTemplateStore } from "@/lib/scenario/template-store";

export class DbScenarioTemplateStore implements ScenarioTemplateStore {
  constructor(private readonly database: DatabaseClient) {}

  async listPublished(): Promise<ScenarioTemplate[]> {
    return scenarioTemplatesSchema.parse(
      (await this.selectPublished()).map(mapTemplate),
    );
  }

  async getPublishedById(
    scenarioId: string,
  ): Promise<ScenarioTemplate | null> {
    const [row] = await this.selectPublished(scenarioId);
    return row ? scenarioTemplateSchema.parse(mapTemplate(row)) : null;
  }

  private selectPublished(scenarioId?: string) {
    const published = and(
      eq(scenarios.status, "published"),
      eq(scenarioVersions.status, "published"),
      ...(scenarioId
        ? [eq(scenarios.scenarioKey, scenarioId)]
        : []),
    );
    return this.database
      .select({
        id: scenarios.scenarioKey,
        versionId: scenarioVersions.versionKey,
        title: scenarios.title,
        category: scenarios.category,
        summary: scenarioVersions.summary,
        openingMessage: scenarioVersions.firstCustomerMessage,
        hiddenFacts: scenarioVersions.hiddenFacts,
        customerTurns: scenarioVersions.customerTurns,
        scoringDimensions: scenarioVersions.scoringDimensions,
        criticalRisks: scenarioVersions.criticalRisks,
        referenceFlow: scenarioVersions.referenceFlow,
        referenceReply: scenarioVersions.referenceReply,
        sources: scenarioVersions.sources,
        maxTurns: scenarioVersions.maxTurns,
        mockMode: scenarioVersions.mockMode,
      })
      .from(scenarioVersions)
      .innerJoin(
        scenarios,
        eq(scenarioVersions.scenarioId, scenarios.id),
      )
      .where(published)
      .orderBy(asc(scenarios.scenarioKey));
  }
}

function mapTemplate(
  row: Awaited<
    ReturnType<DbScenarioTemplateStore["listPublished"]>
  >[number] | Record<string, unknown>,
): unknown {
  return {
    ...row,
    status: "published",
  };
}
