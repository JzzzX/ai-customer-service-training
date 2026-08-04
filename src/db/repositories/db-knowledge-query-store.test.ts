import { describe, expect, it } from "vitest";

import { DbKnowledgeQueryStore } from "./db-knowledge-query-store";
import type { DatabaseClient } from "../client";
import {
  knowledgeSources,
  knowledgeUnits,
  knowledgeVersions,
  questions,
  quizSets,
  users,
} from "../schema";
import { createTestDatabase } from "../test-support/create-test-database";

describe("DbKnowledgeQueryStore", () => {
  it("summarizes only the active knowledge version", async () => {
    const { client, database } = await createTestDatabase();
    const adminId = "00000000-0000-4000-8000-000000000001";
    const versionId = "00000000-0000-4000-8000-000000000020";
    const unitId = "00000000-0000-4000-8000-000000000030";
    await database.insert(users).values({
      id: adminId,
      email: "admin@example.com",
      name: "管理员",
      passwordHash: "not-used",
      role: "admin",
    });
    await database.insert(knowledgeVersions).values({
      id: versionId,
      versionHash: "a".repeat(64),
      schemaVersion: 1,
      sourceRoot: "TOC售前客服知识库",
      status: "published",
      isActive: true,
      coverage: {},
      createdById: adminId,
    });
    await database.insert(knowledgeSources).values({
      knowledgeVersionId: versionId,
      sourcePath: "产品卖点.md",
      kind: "markdown",
      sourceHash: "b".repeat(64),
      bytes: 128,
      stats: {},
    });
    await database.insert(knowledgeUnits).values({
      id: unitId,
      knowledgeVersionId: versionId,
      unitKey: "ku_test",
      title: "产品卖点",
      content: "测试知识",
      categoryPath: ["产品"],
      contentHash: "c".repeat(64),
      sources: [],
      hasConflict: true,
    });
    await database.insert(questions).values({
      knowledgeVersionId: versionId,
      knowledgeUnitId: unitId,
      questionKey: "q_test",
      type: "true_false",
      prompt: "测试",
      options: ["正确", "错误"],
      correctAnswers: ["正确"],
      explanation: "测试",
      category: "产品",
      createdById: adminId,
    });
    await database.insert(quizSets).values({
      knowledgeVersionId: versionId,
      quizHash: "d".repeat(64),
      title: "正式题组",
      status: "published",
      createdById: adminId,
    });

    const store = new DbKnowledgeQueryStore(
      database as unknown as DatabaseClient,
    );
    await expect(store.loadActiveHealth()).resolves.toMatchObject({
      versionId,
      sourceRoot: "TOC售前客服知识库",
      sourceCount: 1,
      unitCount: 1,
      conflictCount: 1,
      questionCount: 1,
      publishedQuizCount: 1,
      publishedScenarioCount: 0,
    });
    await client.close();
  }, 15_000);
});
