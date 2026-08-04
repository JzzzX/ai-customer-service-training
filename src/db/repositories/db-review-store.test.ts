import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DbReviewStore } from "./db-review-store";
import type { DatabaseClient } from "../client";
import {
  evaluationReports,
  knowledgeVersions,
  reviewDecisions,
  scenarios,
  scenarioVersions,
  trainingMessages,
  trainingSessions,
  users,
} from "../schema";
import { createTestDatabase } from "../test-support/create-test-database";
import { scenarioTemplates } from "@/lib/scenario/templates";

const adminId = "00000000-0000-4000-8000-000000000001";
const learnerId = "00000000-0000-4000-8000-000000000002";
const knowledgeVersionId =
  "00000000-0000-4000-8000-000000000020";
const scenarioId = "00000000-0000-4000-8000-000000000030";
const scenarioVersionId =
  "00000000-0000-4000-8000-000000000040";
const sessionId = "00000000-0000-4000-8000-000000000050";
const reportId = "00000000-0000-4000-8000-000000000060";
const template = scenarioTemplates[0]!;

describe("DbReviewStore", () => {
  let client: Awaited<
    ReturnType<typeof createTestDatabase>
  >["client"];
  let database: Awaited<
    ReturnType<typeof createTestDatabase>
  >["database"];
  let store: DbReviewStore;

  beforeEach(async () => {
    ({ client, database } = await createTestDatabase());
    await seedReview();
    store = new DbReviewStore(
      database as unknown as DatabaseClient,
    );
  });

  afterEach(async () => {
    await client.close();
  });

  it("lists unresolved review reports with transcript and full evidence", async () => {
    const [pending] = await store.listPending();

    expect(pending).toMatchObject({
      reportId,
      learnerId,
      learnerName: "测试学员",
      scenarioTitle: template.title,
      totalScore: 60,
      verdict: "needs_retry",
      reviewTrigger: "failed",
      missedSteps: ["未确认宠物年龄"],
      transcript: [
        { role: "customer", content: template.openingMessage },
        { role: "learner", content: "可以直接购买这款。" },
      ],
    });
    await expect(store.load(reportId)).resolves.toEqual(pending);
  });

  it("records one immutable admin decision and removes it from pending", async () => {
    const input = {
      reportId,
      reviewerId: adminId,
      status: "adjusted" as const,
      correctedVerdict: "needs_retry" as const,
      correctedScore: 65,
      comment: "补充考虑了安抚表达，但流程仍需重练。",
    };

    const first = await store.decide(input);
    const second = await store.decide(input);

    expect(second).toEqual(first);
    expect(first.decision).toEqual(input);
    await expect(store.listPending()).resolves.toEqual([]);
    await expect(
      database.select().from(reviewDecisions),
    ).resolves.toHaveLength(1);
  });

  it("rejects non-admin reviewers and conflicting second decisions", async () => {
    await expect(
      store.decide({
        reportId,
        reviewerId: learnerId,
        status: "confirmed",
        comment: "越权确认",
      }),
    ).rejects.toThrow("复核管理员不存在或未启用");

    await store.decide({
      reportId,
      reviewerId: adminId,
      status: "confirmed",
      comment: "确认原报告",
    });
    await expect(
      store.decide({
        reportId,
        reviewerId: adminId,
        status: "dismissed",
        comment: "尝试覆盖",
      }),
    ).rejects.toThrow("该报告已有复核结论");
  });

  async function seedReview() {
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
        name: "测试学员",
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
      coverage: {},
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
      status: "published",
      publishedAt: new Date(),
      createdById: adminId,
    });
    await database.insert(trainingSessions).values({
      id: sessionId,
      learnerId,
      knowledgeVersionId,
      scenarioVersionId,
      status: "needs_review",
      mode: "mock",
      turnCount: 1,
      startedAt: new Date("2026-07-30T01:00:00.000Z"),
      completedAt: new Date("2026-07-30T01:05:00.000Z"),
    });
    await database.insert(trainingMessages).values([
      {
        trainingSessionId: sessionId,
        position: 0,
        sender: "customer",
        content: template.openingMessage,
        createdAt: new Date("2026-07-30T01:00:00.000Z"),
      },
      {
        trainingSessionId: sessionId,
        position: 1,
        sender: "learner",
        content: "可以直接购买这款。",
        createdAt: new Date("2026-07-30T01:01:00.000Z"),
      },
    ]);
    await database.insert(evaluationReports).values({
      id: reportId,
      trainingSessionId: sessionId,
      knowledgeVersionId,
      totalScore: 60,
      verdict: "needs_retry",
      dimensions: [
        { name: "需求识别", score: 8, maxScore: 20, evidence: [] },
        { name: "流程完整", score: 8, maxScore: 20, evidence: [] },
        { name: "知识准确", score: 14, maxScore: 20, evidence: [] },
        { name: "沟通体验", score: 12, maxScore: 20, evidence: [] },
        { name: "风险控制", score: 18, maxScore: 20, evidence: [] },
      ],
      strengths: ["表达简洁"],
      omissions: ["未确认宠物年龄"],
      risks: [],
      recommendations: [
        {
          issue: "需求确认不足",
          suggestedReply: "先确认年龄、体重和主诉",
        },
      ],
      turnFeedback: [],
      recommendedFlow: template.referenceFlow,
      sampleReply: template.referenceReply,
      evidence: [],
      confidence: "0.920",
      needsReview: true,
      reviewTrigger: "failed",
      createdAt: new Date("2026-07-30T01:05:00.000Z"),
    });
  }
});
