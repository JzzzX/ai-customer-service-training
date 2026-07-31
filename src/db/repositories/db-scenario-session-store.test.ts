import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DbScenarioSessionStore } from "./db-scenario-session-store";
import type { DatabaseClient } from "../client";
import {
  assignments,
  evaluationReports,
  knowledgeVersions,
  scenarios,
  scenarioVersions,
  trainingMessages,
  trainingSessions,
  users,
} from "../schema";
import { createTestDatabase } from "../test-support/create-test-database";
import { MockEvaluationProvider } from "@/lib/scenario/mock-providers";
import { scenarioTemplates } from "@/lib/scenario/templates";

const adminId = "00000000-0000-4000-8000-000000000001";
const learnerId = "00000000-0000-4000-8000-000000000002";
const otherLearnerId =
  "00000000-0000-4000-8000-000000000003";
const knowledgeVersionId =
  "00000000-0000-4000-8000-000000000020";
const scenarioId = "00000000-0000-4000-8003-000000000001";
const scenarioVersionId =
  "00000000-0000-4000-8004-000000000001";
const assignmentId = "00000000-0000-4000-8000-000000000040";
const template = scenarioTemplates[0]!;

describe("DbScenarioSessionStore", () => {
  let client: Awaited<
    ReturnType<typeof createTestDatabase>
  >["client"];
  let database: Awaited<
    ReturnType<typeof createTestDatabase>
  >["database"];
  let store: DbScenarioSessionStore;

  beforeEach(async () => {
    ({ client, database } = await createTestDatabase());
    await seedScenario();
    store = new DbScenarioSessionStore(
      database as unknown as DatabaseClient,
    );
  });

  afterEach(async () => {
    await client.close();
  });

  it("starts a durable session with opening message position zero", async () => {
    const session = await store.startSession({
      learnerId,
      scenario: template,
      mode: "mock",
      startedAt: "2026-07-30T01:00:00.000Z",
    });

    expect(session).toMatchObject({
      learnerId,
      scenarioId: template.id,
      scenarioVersionId: template.versionId,
      status: "active",
      learnerTurnCount: 0,
    });
    const messages = await database
      .select()
      .from(trainingMessages)
      .where(eq(trainingMessages.trainingSessionId, session.id));
    expect(messages).toEqual([
      expect.objectContaining({
        position: 0,
        sender: "customer",
        content: template.openingMessage,
      }),
    ]);
  });

  it("enforces learner ownership in the session query", async () => {
    const session = await store.startSession({
      learnerId,
      scenario: template,
      mode: "mock",
    });

    await expect(
      store.loadSession({
        learnerId: otherLearnerId,
        sessionId: session.id,
      }),
    ).rejects.toThrow("无权访问该训练会话");
  });

  it("appends one exchange atomically and rejects a stale turn count", async () => {
    const session = await store.startSession({
      learnerId,
      scenario: template,
      mode: "mock",
    });
    const updated = await store.appendExchange({
      learnerId,
      sessionId: session.id,
      expectedTurnCount: 0,
      learnerMessage: "请先告诉我宠物年龄和体重。",
      customerReply: "刚满3个月，2.1公斤。",
    });

    expect(updated.learnerTurnCount).toBe(1);
    expect(updated.messages.map((message) => message.role)).toEqual([
      "customer",
      "learner",
      "customer",
    ]);
    await expect(
      store.appendExchange({
        learnerId,
        sessionId: session.id,
        expectedTurnCount: 0,
        learnerMessage: "重复提交",
        customerReply: "不应写入",
      }),
    ).rejects.toThrow("会话已更新");
    await expect(
      database
        .select()
        .from(trainingMessages)
        .where(eq(trainingMessages.trainingSessionId, session.id)),
    ).resolves.toHaveLength(3);
  });

  it("persists a live risk alert on the learner message metadata", async () => {
    const session = await store.startSession({
      learnerId,
      scenario: template,
      mode: "mock",
    });
    const riskAlert = {
      riskLabel: "绝对化产品承诺",
      suggestion: "避免使用「保证不软便」类表述。",
      severity: "warning" as const,
    };

    const updated = await store.appendExchange({
      learnerId,
      sessionId: session.id,
      expectedTurnCount: 0,
      learnerMessage: "这款粮保证不软便。",
      customerReply: "那需要怎么换粮？",
      riskAlert,
    });

    const learnerMessage = updated.messages.find(
      (message) => message.role === "learner",
    );
    expect(learnerMessage?.riskAlert).toEqual(riskAlert);

    const reloaded = await store.loadSession({
      learnerId,
      sessionId: session.id,
    });
    const reloadedLearner = reloaded.messages.find(
      (message) => message.role === "learner",
    );
    expect(reloadedLearner?.riskAlert).toEqual(riskAlert);
  });

  it("completes once, persists the report and completes the assignment", async () => {
    await database.insert(assignments).values({
      id: assignmentId,
      learnerId,
      assignedById: adminId,
      assignmentType: "scenario",
      scenarioVersionId,
      status: "in_progress",
      startedAt: new Date(),
    });
    const session = await store.startSession({
      learnerId,
      scenario: template,
      mode: "mock",
      assignmentId,
    });
    const report = await new MockEvaluationProvider().evaluate({
      scenario: template,
      learnerMessages: ["年龄"],
    });

    const first = await store.completeSession({
      learnerId,
      sessionId: session.id,
      report,
      completedAt: "2026-07-30T01:05:00.000Z",
    });
    const second = await store.completeSession({
      learnerId,
      sessionId: session.id,
      report,
      completedAt: "2026-07-30T01:06:00.000Z",
    });

    expect(second).toEqual(first);
    expect(first.status).toBe("completed");
    expect(first.report).toEqual(report);
    await expect(
      database.select().from(evaluationReports),
    ).resolves.toHaveLength(1);
    const [assignment] = await database
      .select()
      .from(assignments)
      .where(eq(assignments.id, assignmentId));
    expect(assignment?.status).toBe("completed");
    const [storedSession] = await database
      .select()
      .from(trainingSessions)
      .where(eq(trainingSessions.id, session.id));
    expect(storedSession?.status).toBe("needs_review");
  });

  async function seedScenario(): Promise<void> {
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
        name: "学员",
        passwordHash: "not-used",
        role: "learner",
      },
      {
        id: otherLearnerId,
        email: "other@example.com",
        name: "其他学员",
        passwordHash: "not-used",
        role: "learner",
      },
    ]);
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
    await database.insert(scenarios).values({
      id: scenarioId,
      scenarioKey: template.id,
      title: template.title,
      category: template.category,
      status: "published",
      createdById: adminId,
    });
    await database.insert(scenarioVersions).values({
      id: scenarioVersionId,
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
});
