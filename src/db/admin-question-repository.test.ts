// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  AdminQuestionConflictError,
  createAdminQuestionRepository,
} from "./admin-question-repository";
import { createTestDatabase } from "./test-support/create-test-database";
import { ensureQuestionRevision } from "./question-revision-publication";
import { knowledgeVersions, users } from "./schema";

describe("admin question repository", () => {
  let fixture: Awaited<ReturnType<typeof createTestDatabase>>;

  beforeEach(async () => {
    fixture = await createTestDatabase();
    await fixture.database.insert(users).values({
      id: "admin-1",
      email: "admin@example.test",
      name: "管理员",
      passwordHash: "disabled",
      role: "admin",
      isActive: true,
    });
    await fixture.database.insert(knowledgeVersions).values({
      id: "knowledge-1",
      versionHash: "1".repeat(64),
      contentHash: "2".repeat(64),
      schemaVersion: 1,
      sourceRoot: "admin-test",
      status: "published",
      isActive: true,
      coverage: {},
      publishedAt: new Date(1000),
    });
    fixture.database.transaction((transaction) => {
      ensureQuestionRevision(transaction, questionInput());
    });
  });

  afterEach(() => fixture.client.close());

  it("lists current questions with filters, sources, and immutable history", async () => {
    const repository = createAdminQuestionRepository(fixture.database);

    expect(
      await repository.list({
        category: "产品属性及卖点",
        status: "published",
        stableKey: "qq_admin",
        keyword: "蛋白",
      }),
    ).toEqual([
      expect.objectContaining({
        stableKey: "qq_admin_0000000000000001",
        current: expect.objectContaining({
          revision: 1,
          prompt: "这款猫粮的蛋白含量是多少？",
          status: "published",
          sources: [expect.objectContaining({ sourcePath: "产品.md" })],
        }),
        history: [expect.objectContaining({ revision: 1 })],
      }),
    ]);
  });

  it.each([
    [{ options: ["A", "A"] }, "选项不能重复"],
    [{ options: ["A", "B"], correctAnswers: ["C"] }, "正确答案必须属于选项"],
    [{ explanation: "  " }, "解析不能为空"],
  ])("rejects an invalid draft: %s", async (patch, message) => {
    const repository = createAdminQuestionRepository(fixture.database);
    const current = (await repository.list({}))[0]!;

    await expect(
      repository.createDraft({
        catalogId: current.catalogId,
        baseRevisionId: current.current.id,
        actorId: "admin-1",
        changes: { ...editableChanges(), ...patch },
      }),
    ).rejects.toThrow(message);
  });

  it("creates a draft copy and atomically publishes it without changing historical answers", async () => {
    const repository = createAdminQuestionRepository(fixture.database);
    const before = (await repository.list({}))[0]!;
    seedHistoricalAnswer(before.current.id);

    const draft = await repository.createDraft({
      catalogId: before.catalogId,
      baseRevisionId: before.current.id,
      actorId: "admin-1",
      changes: editableChanges(),
    });

    expect(draft).toMatchObject({ revision: 2, status: "draft" });
    expect((await repository.list({}))[0]!.current.id).toBe(before.current.id);
    expect(await repository.list({ status: "draft" })).toHaveLength(1);
    expect(await repository.list({ status: "draft", category: "产品属性及卖点", keyword: "修订后" })).toHaveLength(1);
    expect(await repository.list({ status: "draft", category: "不存在", keyword: "修订后" })).toEqual([]);

    await repository.publishDraft({
      catalogId: before.catalogId,
      draftRevisionId: draft.id,
      expectedCurrentRevisionId: before.current.id,
      actorId: "admin-1",
    });

    const after = (await repository.list({}))[0]!;
    expect(after.current).toMatchObject({
      id: draft.id,
      revision: 2,
      prompt: "修订后的题干",
      status: "published",
    });
    expect(after.history.map((revision) => revision.revision)).toEqual([2, 1]);
    expect(await repository.list({ status: "draft" })).toEqual([]);
    expect(
      fixture.client
        .prepare("SELECT question_id AS questionId FROM quiz_answers")
        .get(),
    ).toEqual({ questionId: before.current.id });
  });

  it.each([
    ["prompt = '   '", "题干不能为空"],
    ["options = '[\"A\",\"A\"]'", "选项不能重复"],
    ["options = '[\"A\",\"B\"]', correct_answers = '[\"C\"]'", "正确答案必须属于选项"],
    ["correct_answers = '[]'", "正确答案"],
    ["explanation = '   '", "解析不能为空"],
    ["category = '   '", "分类不能为空"],
    ["sources = '[]'", "题目来源不可追溯"],
  ])("revalidates a persisted draft before publishing: %s", async (mutation, message) => {
    const repository = createAdminQuestionRepository(fixture.database);
    const before = (await repository.list({}))[0]!;
    const draft = await repository.createDraft({
      catalogId: before.catalogId,
      baseRevisionId: before.current.id,
      actorId: "admin-1",
      changes: editableChanges(),
    });
    fixture.client.exec(`UPDATE questions SET ${mutation} WHERE id = '${draft.id}'`);

    await expect(repository.publishDraft({
      catalogId: before.catalogId,
      draftRevisionId: draft.id,
      expectedCurrentRevisionId: before.current.id,
      actorId: "admin-1",
    })).rejects.toThrow(message);
    expect((await repository.list({}))[0]!.current.id).toBe(before.current.id);
    expect(fixture.client.prepare("SELECT status FROM questions WHERE id = ?").get(draft.id)).toEqual({ status: "draft" });
  });

  it("rejects concurrent publication when the current pointer has changed", async () => {
    const repository = createAdminQuestionRepository(fixture.database);
    const before = (await repository.list({}))[0]!;
    const first = await repository.createDraft({
      catalogId: before.catalogId,
      baseRevisionId: before.current.id,
      actorId: "admin-1",
      changes: editableChanges(),
    });
    const second = await repository.createDraft({
      catalogId: before.catalogId,
      baseRevisionId: before.current.id,
      actorId: "admin-1",
      changes: { ...editableChanges(), prompt: "另一个并发草稿" },
    });
    await repository.publishDraft({
      catalogId: before.catalogId,
      draftRevisionId: first.id,
      expectedCurrentRevisionId: before.current.id,
      actorId: "admin-1",
    });

    await expect(
      repository.publishDraft({
        catalogId: before.catalogId,
        draftRevisionId: second.id,
        expectedCurrentRevisionId: before.current.id,
        actorId: "admin-1",
      }),
    ).rejects.toBeInstanceOf(AdminQuestionConflictError);
  });

  function seedHistoricalAnswer(questionId: string): void {
    fixture.client.exec(`
      INSERT INTO users (id, email, name, password_hash, role, is_active)
      VALUES ('learner-1', 'learner@example.test', '学员', 'disabled', 'learner', 1);
      INSERT INTO quiz_sets
        (id, knowledge_version_id, quiz_hash, content_hash, title, kind, status)
      VALUES ('set-1', 'knowledge-1', '${"3".repeat(64)}', '${"4".repeat(64)}', '历史题组', 'formal', 'archived');
      INSERT INTO quiz_set_questions (quiz_set_id, question_id, position, points)
      VALUES ('set-1', '${questionId}', 0, 1);
      INSERT INTO quiz_attempts
        (id, quiz_set_id, learner_id, knowledge_version_id, status, total_questions, started_at, completed_at)
      VALUES ('attempt-1', 'set-1', 'learner-1', 'knowledge-1', 'needs_retry', 1, 1000, 1000);
      INSERT INTO quiz_answers
        (id, quiz_attempt_id, question_id, selected_answers, is_correct, answered_at)
      VALUES ('answer-1', 'attempt-1', '${questionId}', '["32%"]', 0, 1000);
    `);
  }
});

function questionInput() {
  return {
    stableKey: "qq_admin_0000000000000001",
    knowledgeVersionId: "knowledge-1",
    knowledgeUnitId: null,
    knowledgeUnitKey: "ku_admin_0000000000000001",
    type: "single_choice" as const,
    prompt: "这款猫粮的蛋白含量是多少？",
    options: ["32%", "40%"],
    correctAnswers: ["40%"],
    explanation: "产品资料标注为 40%。",
    category: "产品属性及卖点",
    difficulty: "easy" as const,
    sources: [
      {
        sourcePath: "产品.md",
        kind: "markdown" as const,
        anchor: "蛋白含量",
        path: ["猫粮", "营养值"],
      },
    ],
  };
}

function editableChanges() {
  return {
    prompt: "修订后的题干",
    options: ["32%", "40%"],
    correctAnswers: ["40%"],
    explanation: "修订后的完整解析。",
    category: "产品属性及卖点",
    difficulty: "medium" as const,
  };
}
