// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DbPublishedQuizStore } from "./db-published-quiz-store";
import { createAdminQuestionRepository } from "../admin-question-repository";
import type { DatabaseClient } from "../client";
import { knowledgeVersions, users } from "../schema";
import { createTestDatabase } from "../test-support/create-test-database";
import { publishTopicQuizCatalog } from "../topic-quiz-publication";
import { topicQuizQuestions } from "@/lib/quiz/question-bank";

describe("DbPublishedQuizStore", () => {
  let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
  let store: DbPublishedQuizStore;

  beforeEach(async () => {
    fixture = await createTestDatabase();
    await fixture.database.insert(knowledgeVersions).values({
      id: "knowledge-published",
      versionHash: "1".repeat(64),
      contentHash: "a".repeat(64),
      schemaVersion: 1,
      sourceRoot: "published-test",
      status: "published",
      isActive: true,
      coverage: {},
      publishedAt: new Date(1000),
    });
    publishTopicQuizCatalog(fixture.database);
    store = new DbPublishedQuizStore(
      fixture.database as unknown as DatabaseClient,
    );
  });

  afterEach(() => fixture.client.close());

  it("loads a published topic set and its direct revision sources from SQLite", async () => {
    const pack = await store.loadPublishedTopic("日常问答");

    expect(pack).toMatchObject({
      kind: "topic",
      topicId: "日常问答",
      status: "published",
      passingScore: 80,
    });
    expect(pack?.questions).toHaveLength(66);
    const expected = topicQuizQuestions.find(
      (question) => question.category === "日常问答",
    )!;
    expect(pack?.questions[0]).toMatchObject({
      id: expected.id,
      knowledgeUnitId: expected.knowledgeUnitId,
      sources: expected.sources,
    });
  });

  it("lists published topic categories and does not treat them as the formal set", async () => {
    await expect(store.loadPublished()).resolves.toBeNull();
    await expect(store.listPublishedTopics()).resolves.toEqual([
      { topicId: "产品属性及卖点", questionCount: 65 },
      { topicId: "宠物生理和喂养", questionCount: 72 },
      { topicId: "日常问答", questionCount: 66 },
      { topicId: "服务流程与规则", questionCount: 75 },
      { topicId: "活动促销", questionCount: 72 },
    ]);
  });

  it("loads a formal set independently from newer topic publications", async () => {
    const source = topicQuizQuestions[0]!;
    fixture.client.exec(`
      INSERT INTO question_catalogs (id, stable_key) VALUES ('formal-catalog', 'qq_ffffffffffffffffffffffff');
      INSERT INTO questions
        (id, question_catalog_id, revision, content_hash, knowledge_version_id,
         knowledge_unit_id, knowledge_unit_key, question_key, type, prompt,
         options, correct_answers, explanation, category, difficulty, sources, status)
      VALUES
        ('formal-question', 'formal-catalog', 1, '${"b".repeat(64)}', 'knowledge-published',
         NULL, 'ku_ffffffffffffffffffffffff', 'qq_ffffffffffffffffffffffff',
         'single_choice', '正式题', '["A","B"]', '["A"]', '说明', '正式',
         'easy', '${JSON.stringify(source.sources).replaceAll("'", "''")}', 'published');
      INSERT INTO quiz_sets
        (id, knowledge_version_id, quiz_hash, content_hash, source_quiz_hash,
         title, kind, status, passing_score, published_at)
      VALUES
        ('formal-set', 'knowledge-published', '${"c".repeat(64)}', '${"d".repeat(64)}',
         '${"e".repeat(64)}', '正式题组', 'formal', 'published', 80, 2000);
      INSERT INTO quiz_set_questions (quiz_set_id, question_id, position, points)
      VALUES ('formal-set', 'formal-question', 0, 1);
      INSERT INTO question_catalog_publications
        (catalog_id, current_question_id, published_at, updated_at)
      VALUES ('formal-catalog', 'formal-question', 2000, 2000);
    `);

    await expect(store.loadPublished()).resolves.toMatchObject({
      kind: "formal",
      title: "正式题组",
      questions: [expect.objectContaining({ id: "qq_ffffffffffffffffffffffff" })],
    });
  });

  it("serves the current published revision while preserving the quiz set's stable position", async () => {
    await fixture.database.insert(users).values({
      id: "admin-1", email: "admin@example.test", name: "管理员", passwordHash: "disabled", role: "admin",
    });
    const repository = createAdminQuestionRepository(fixture.database);
    const original = (await repository.list({ stableKey: topicQuizQuestions[0]!.id }))[0]!;
    const draft = await repository.createDraft({
      catalogId: original.catalogId,
      baseRevisionId: original.current.id,
      actorId: "admin-1",
      changes: {
        prompt: "管理员修订后的题干",
        options: original.current.options,
        correctAnswers: original.current.correctAnswers,
        explanation: "管理员修订后的解析。",
        category: original.current.category,
        difficulty: original.current.difficulty,
      },
    });
    await repository.publishDraft({
      catalogId: original.catalogId,
      draftRevisionId: draft.id,
      expectedCurrentRevisionId: original.current.id,
      actorId: "admin-1",
    });

    const pack = await store.loadPublishedTopic(topicQuizQuestions[0]!.category);
    expect(pack?.questions.find((question) => question.id === topicQuizQuestions[0]!.id)).toMatchObject({
      prompt: "管理员修订后的题干",
      explanation: "管理员修订后的解析。",
    });
  });
});
