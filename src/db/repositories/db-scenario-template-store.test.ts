import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DbScenarioTemplateStore } from "./db-scenario-template-store";
import type { DatabaseClient } from "../client";
import {
  knowledgeVersions,
  scenarios,
  scenarioVersions,
  users,
} from "../schema";
import { createTestDatabase } from "../test-support/create-test-database";
import { scenarioTemplates } from "@/lib/scenario/templates";

const adminId = "00000000-0000-4000-8000-000000000001";
const knowledgeVersionId =
  "00000000-0000-4000-8000-000000000020";

describe("DbScenarioTemplateStore", () => {
  let client: Awaited<
    ReturnType<typeof createTestDatabase>
  >["client"];
  let database: Awaited<
    ReturnType<typeof createTestDatabase>
  >["database"];
  let store: DbScenarioTemplateStore;

  beforeEach(async () => {
    ({ client, database } = await createTestDatabase());
    await seedTemplates();
    store = new DbScenarioTemplateStore(
      database as unknown as DatabaseClient,
    );
  });

  afterEach(async () => {
    await client.close();
  });

  it("reconstructs all eight full published templates", async () => {
    const templates = await store.listPublished();

    expect(templates).toHaveLength(8);
    expect(templates[0]).toEqual(scenarioTemplates[0]);
    expect(
      templates.every(
        (template) =>
          template.mockMode &&
          template.status === "published" &&
          template.scoringDimensions.length === 5,
      ),
    ).toBe(true);
  });

  it("queries by external scenario id and never returns a draft", async () => {
    await expect(
      store.getPublishedById(scenarioTemplates[0]!.id),
    ).resolves.toEqual(scenarioTemplates[0]);

    await database
      .update(scenarioVersions)
      .set({ status: "draft" })
      .where(
        eq(
          scenarioVersions.versionKey,
          scenarioTemplates[0]!.versionId,
        ),
      );
    await expect(
      store.getPublishedById(scenarioTemplates[0]!.id),
    ).resolves.toBeNull();
  });

  async function seedTemplates(): Promise<void> {
    await database.insert(users).values({
      id: adminId,
      email: "admin@example.com",
      name: "管理员",
      passwordHash: "not-used",
      role: "admin",
    });
    await database.insert(knowledgeVersions).values({
      id: knowledgeVersionId,
      versionHash: "a".repeat(64),
      schemaVersion: 1,
      sourceRoot: "TOC售前客服知识库",
      status: "published",
      isActive: true,
      coverage: { sourceFiles: 8 },
      publishedAt: new Date(),
      createdById: adminId,
    });
    for (const [index, template] of scenarioTemplates.entries()) {
      const scenarioId = `00000000-0000-4000-8003-${String(index).padStart(
        12,
        "0",
      )}`;
      await database.insert(scenarios).values({
        id: scenarioId,
        scenarioKey: template.id,
        title: template.title,
        category: template.category,
        status: "published",
        createdById: adminId,
      });
      await database.insert(scenarioVersions).values({
        id: `00000000-0000-4000-8004-${String(index).padStart(
          12,
          "0",
        )}`,
        scenarioId,
        versionKey: template.versionId,
        version: 1,
        knowledgeVersionId,
        background: template.summary,
        summary: template.summary,
        firstCustomerMessage: template.openingMessage,
        controlledVariables: {},
        hiddenFacts: template.hiddenFacts,
        customerTurns: template.customerTurns,
        checkpoints: template.referenceFlow,
        prohibitions: template.criticalRisks.map((risk) => risk.label),
        scoringWeights: Object.fromEntries(
          template.scoringDimensions.map((dimension) => [
            dimension.name,
            dimension.weight,
          ]),
        ),
        scoringDimensions: template.scoringDimensions,
        criticalRisks: template.criticalRisks,
        referenceFlow: template.referenceFlow,
        referenceReply: template.referenceReply,
        sources: template.sources,
        maxTurns: template.maxTurns,
        mockMode: true,
        customerPersona: template.customerPersona ?? null,
        difficulty: template.difficulty,
        status: "published",
        publishedAt: new Date(),
        createdById: adminId,
      });
    }
  }
});
