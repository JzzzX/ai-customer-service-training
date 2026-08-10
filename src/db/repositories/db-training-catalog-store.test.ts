import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DbTrainingCatalogStore } from "./db-training-catalog-store";
import type { DatabaseClient } from "../client";
import {
  knowledgeVersions,
  quizSets,
  scenarios,
  scenarioVersions,
  users,
} from "../schema";
import { createTestDatabase } from "../test-support/create-test-database";
import { scenarioTemplates } from "@/lib/scenario/templates";

const adminId = "00000000-0000-4000-8000-000000000001";
const learnerId = "00000000-0000-4000-8000-000000000002";
const inactiveId = "00000000-0000-4000-8000-000000000003";
const knowledgeId = "00000000-0000-4000-8000-000000000020";
const quizId = "00000000-0000-4000-8000-000000000030";
const scenarioId = "00000000-0000-4000-8000-000000000040";
const versionId = "00000000-0000-4000-8000-000000000050";
const template = scenarioTemplates[0]!;

describe("DbTrainingCatalogStore", () => {
  let client: Awaited<
    ReturnType<typeof createTestDatabase>
  >["client"];
  let database: Awaited<
    ReturnType<typeof createTestDatabase>
  >["database"];

  beforeEach(async () => {
    ({ client, database } = await createTestDatabase());
    await database.insert(users).values([
      {
        id: adminId,
        email: "admin@example.com",
        name: "管理员",
        passwordHash: "not-used",
        role: "admin",
      },
      {
        id: learnerId,
        email: "learner@example.com",
        name: "正式学员",
        passwordHash: "not-used",
        role: "learner",
      },
      {
        id: inactiveId,
        email: "inactive@example.com",
        name: "停用学员",
        passwordHash: "not-used",
        role: "learner",
        isActive: false,
      },
    ]);
    await database.insert(knowledgeVersions).values({
      id: knowledgeId,
      versionHash: "a".repeat(64),
      schemaVersion: 1,
      sourceRoot: "TOC售前客服知识库",
      status: "published",
      isActive: true,
      coverage: {},
      createdById: adminId,
    });
    await database.insert(quizSets).values({
      id: quizId,
      knowledgeVersionId: knowledgeId,
      quizHash: "b".repeat(64),
      title: "40题正式题组",
      status: "published",
      createdById: adminId,
    });
    await database.insert(scenarios).values({
      id: scenarioId,
      scenarioKey: template.id,
      title: template.title,
      category: template.category,
      status: "published",
      createdById: adminId,
    });
    await database.insert(scenarioVersions).values({
      id: versionId,
      scenarioId,
      versionKey: template.versionId,
      version: 1,
      knowledgeVersionId: knowledgeId,
      background: template.summary,
      summary: template.summary,
      firstCustomerMessage: template.openingMessage,
      controlledVariables: {},
      hiddenFacts: template.hiddenFacts,
      customerTurns: template.customerTurns,
      checkpoints: template.referenceFlow,
      prohibitions: template.criticalRisks.map((risk) => risk.label),
      scoringWeights: {},
      scoringDimensions: template.scoringDimensions,
      criticalRisks: template.criticalRisks,
      referenceFlow: template.referenceFlow,
      referenceReply: template.referenceReply,
      sources: template.sources,
      maxTurns: template.maxTurns,
      status: "published",
      createdById: adminId,
    });
  });

  afterEach(async () => client.close());

  it("lists only active learners and published immutable targets", async () => {
    const store = new DbTrainingCatalogStore(
      database as unknown as DatabaseClient,
    );

    await expect(store.listLearners()).resolves.toEqual([
      {
        id: learnerId,
        name: "正式学员",
        email: "learner@example.com",
      },
    ]);
    await expect(store.listTargets()).resolves.toEqual([
      { id: quizId, type: "quiz", label: "40题正式题组" },
      {
        id: versionId,
        type: "scenario",
        label: template.title,
      },
    ]);
  });
});
