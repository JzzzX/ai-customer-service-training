import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { DbKnowledgeQueryStore } from "./db-knowledge-query-store";
import type { DatabaseClient } from "../client";
import {
  knowledgeSources,
  knowledgeUnits,
  knowledgeVersions,
  questionCatalogs,
  questions,
  quizSets,
  users,
} from "../schema";
import { createTestDatabase } from "../test-support/create-test-database";

describe("DbKnowledgeQueryStore", () => {
  it("ignores an active knowledge version until it is published", async () => {
    const { client, database } = await createTestDatabase();
    await database.insert(knowledgeVersions).values({
      id: "00000000-0000-4000-8000-000000000010",
      versionHash: "1".repeat(64),
      contentHash: "2".repeat(64),
      schemaVersion: 1,
      sourceRoot: "draft-knowledge",
      status: "draft",
      isActive: true,
      coverage: {},
    });
    await database.insert(knowledgeUnits).values({
      id: "00000000-0000-4000-8000-000000000011",
      knowledgeVersionId: "00000000-0000-4000-8000-000000000010",
      unitKey: "ku_draft_complaint",
      title: "客诉处理",
      content: "未发布的客诉知识",
      categoryPath: ["客诉"],
      contentHash: "3".repeat(64),
      sources: [{ sourcePath: "draft.md", kind: "markdown", anchor: "客诉", path: ["客诉"] }],
      canUseForScenario: true,
    });

    const store = new DbKnowledgeQueryStore(database as unknown as DatabaseClient);
    await expect(store.loadActiveHealth()).resolves.toBeNull();
    await expect(store.listUnitsForScenario("complaint")).resolves.toEqual([]);
    await client.close();
  });

  it("invalidates scenario knowledge cache when the published active version changes", async () => {
    const { client, database } = await createTestDatabase();
    const firstVersionId = "00000000-0000-4000-8000-000000000012";
    const secondVersionId = "00000000-0000-4000-8000-000000000013";
    await database.insert(knowledgeVersions).values({
      id: firstVersionId,
      versionHash: "4".repeat(64),
      contentHash: "5".repeat(64),
      schemaVersion: 1,
      sourceRoot: "first",
      status: "published",
      isActive: true,
      coverage: {},
    });
    await database.insert(knowledgeUnits).values({
      id: "00000000-0000-4000-8000-000000000014",
      knowledgeVersionId: firstVersionId,
      unitKey: "ku_first_logistics",
      title: "物流旧规则",
      content: "旧物流时效",
      categoryPath: ["物流"],
      contentHash: "6".repeat(64),
      sources: [{ sourcePath: "first.md", kind: "markdown", anchor: "物流", path: ["物流"] }],
      canUseForScenario: true,
    });
    const store = new DbKnowledgeQueryStore(database as unknown as DatabaseClient);
    await expect(store.listUnitsForScenario("logistics"))
      .resolves.toMatchObject([{ title: "物流旧规则" }]);

    await database.update(knowledgeVersions).set({ isActive: false }).where(eq(knowledgeVersions.id, firstVersionId));
    await database.insert(knowledgeVersions).values({
      id: secondVersionId,
      versionHash: "7".repeat(64),
      contentHash: "8".repeat(64),
      schemaVersion: 1,
      sourceRoot: "second",
      status: "published",
      isActive: true,
      coverage: {},
    });
    await database.insert(knowledgeUnits).values({
      id: "00000000-0000-4000-8000-000000000015",
      knowledgeVersionId: secondVersionId,
      unitKey: "ku_second_logistics",
      title: "物流新规则",
      content: "新物流时效",
      categoryPath: ["物流"],
      contentHash: "9".repeat(64),
      sources: [{ sourcePath: "second.md", kind: "markdown", anchor: "物流", path: ["物流"] }],
      canUseForScenario: true,
    });

    await expect(store.listUnitsForScenario("logistics"))
      .resolves.toMatchObject([{ title: "物流新规则" }]);
    await client.close();
  });

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
    });
    await database.insert(knowledgeVersions).values({
      id: versionId,
      versionHash: "a".repeat(64),
      contentHash: "0".repeat(64),
      schemaVersion: 1,
      sourceRoot: "TOC售前客服知识库",
      status: "published",
      isActive: true,
      coverage: {},
    });
    await database.insert(knowledgeSources).values({
      knowledgeVersionId: versionId,
      id: crypto.randomUUID(),
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
    const questionCatalogId = "00000000-0000-4000-8000-000000000035";
    await database.insert(questionCatalogs).values({
      id: questionCatalogId,
      stableKey: "q_test",
    });
    await database.insert(questions).values({
      id: "00000000-0000-4000-8000-000000000040",
      questionCatalogId,
      revision: 1,
      contentHash: "e".repeat(64),
      knowledgeVersionId: versionId,
      knowledgeUnitId: unitId,
      knowledgeUnitKey: "ku_test",
      questionKey: "q_test",
      type: "true_false",
      prompt: "测试",
      options: ["正确", "错误"],
      correctAnswers: ["正确"],
      explanation: "测试",
      category: "产品",
      sources: [],
    });
    await database.insert(quizSets).values({
      id: "00000000-0000-4000-8000-000000000050",
      knowledgeVersionId: versionId,
      quizHash: "d".repeat(64),
      contentHash: "1".repeat(64),
      title: "正式题组",
      status: "published",
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
