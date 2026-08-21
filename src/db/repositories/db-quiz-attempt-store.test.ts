import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DbQuizAttemptStore } from "./db-quiz-attempt-store";
import { createAdminQuestionRepository } from "../admin-question-repository";
import type { DatabaseClient } from "../client";
import {
  knowledgeUnits,
  knowledgeVersions,
  questionCatalogs,
  questionCatalogPublications,
  questions,
  quizAnswers,
  quizAttempts,
  quizSetQuestions,
  quizSets,
  topicQuizAnswers,
  topicQuizAttempts,
  users,
} from "../schema";
import { createTestDatabase } from "../test-support/create-test-database";
import { publishTopicQuizCatalog } from "../topic-quiz-publication";
import { topicQuizQuestions } from "@/lib/quiz/question-bank";

const adminId = "00000000-0000-4000-8000-000000000001";
const learnerId = "00000000-0000-4000-8000-000000000002";
const otherLearnerId =
  "00000000-0000-4000-8000-000000000003";
const knowledgeVersionId =
  "00000000-0000-4000-8000-000000000020";
const quizSetId = "00000000-0000-4000-8000-000000000030";
const attemptId = "00000000-0000-4000-8000-000000000050";
const quizHash = "a".repeat(64);
const firstQuestionKey = `qq_${"1".repeat(24)}`;
const secondQuestionKey = `qq_${"2".repeat(24)}`;

describe("DbQuizAttemptStore", () => {
  let client: Awaited<
    ReturnType<typeof createTestDatabase>
  >["client"];
  let database: Awaited<
    ReturnType<typeof createTestDatabase>
  >["database"];
  let store: DbQuizAttemptStore;

  beforeEach(async () => {
    ({ client, database } = await createTestDatabase());
    await seedPublishedQuiz();
    publishTopicQuizCatalog(database);
    store = new DbQuizAttemptStore(
      database as unknown as DatabaseClient,
    );
  });

  afterEach(async () => {
    await client.close();
  });

  it("persists selected answers and recomputes score from official answers", async () => {
    const record = await store.saveAttempt({
      attemptId,
      learnerId,
      quizHash,
      passingScore: 80,
      answers: [
        {
          questionId: firstQuestionKey,
          selectedAnswers: ["答案一"],
          isCorrect: false,
        },
        {
          questionId: secondQuestionKey,
          selectedAnswers: ["错误"],
          isCorrect: true,
        },
      ],
    });

    expect(record).toMatchObject({
      id: attemptId,
      learnerId,
      quizHash,
      correctCount: 1,
      totalQuestions: 2,
      score: 50,
      status: "needs_retry",
      missedQuestionIds: [secondQuestionKey],
      answeredQuestionIds: [firstQuestionKey, secondQuestionKey],
    });
    const storedAnswers = await database
      .select({
        selectedAnswers: quizAnswers.selectedAnswers,
        isCorrect: quizAnswers.isCorrect,
      })
      .from(quizAnswers)
      .innerJoin(questions, eq(quizAnswers.questionId, questions.id))
      .orderBy(questions.questionKey);
    expect(storedAnswers.map((answer) => answer.selectedAnswers)).toEqual([
      ["答案一"],
      ["错误"],
    ]);
    expect(storedAnswers.map((answer) => answer.isCorrect)).toEqual([
      true,
      false,
    ]);
  });

  it("returns the same attempt for a repeated submission id", async () => {
    const input = {
      attemptId,
      learnerId,
      quizHash,
      passingScore: 80,
      answers: [
        {
          questionId: firstQuestionKey,
          selectedAnswers: ["答案一"],
          isCorrect: true,
        },
      ],
    };

    const first = await store.saveAttempt(input);
    const second = await store.saveAttempt(input);

    expect(second).toEqual(first);
    await expect(database.select().from(quizAttempts)).resolves.toHaveLength(
      1,
    );
    await expect(database.select().from(quizAnswers)).resolves.toHaveLength(
      1,
    );
  });

  it("binds a new answer to the current revision without rewriting the previous version", async () => {
    const repository = createAdminQuestionRepository(database);
    const original = (await repository.list({ stableKey: firstQuestionKey }))[0]!;
    const draft = await repository.createDraft({
      catalogId: original.catalogId,
      baseRevisionId: original.current.id,
      actorId: adminId,
      changes: {
        prompt: "第一题修订版",
        options: ["答案一", "答案二"],
        correctAnswers: ["答案二"],
        explanation: "修订解释",
        category: original.current.category,
        difficulty: original.current.difficulty,
      },
    });
    await repository.publishDraft({
      catalogId: original.catalogId,
      draftRevisionId: draft.id,
      expectedCurrentRevisionId: original.current.id,
      actorId: adminId,
    });

    await store.saveAttempt({
      attemptId,
      learnerId,
      quizHash,
      passingScore: 80,
      answers: [{ questionId: firstQuestionKey, selectedAnswers: ["答案二"], isCorrect: false }],
    });

    expect(client.prepare("SELECT question_id AS questionId FROM quiz_answers").get()).toEqual({ questionId: draft.id });
    expect(client.prepare("SELECT prompt, status FROM questions WHERE id = ?").get(original.current.id)).toEqual({ prompt: "第一题", status: "published" });
  });

  it("isolates history by learner ownership", async () => {
    await store.saveAttempt({
      attemptId,
      learnerId,
      quizHash,
      passingScore: 80,
      answers: [
        {
          questionId: firstQuestionKey,
          selectedAnswers: ["答案一"],
          isCorrect: true,
        },
      ],
    });

    await expect(store.listAttempts(learnerId)).resolves.toHaveLength(1);
    await expect(store.listAttempts(otherLearnerId)).resolves.toEqual([]);
    await expect(
      store.saveAttempt({
        attemptId,
        learnerId: otherLearnerId,
        quizHash,
        passingScore: 80,
        answers: [
          {
            questionId: firstQuestionKey,
            selectedAnswers: ["答案一"],
            isCorrect: true,
          },
        ],
      }),
    ).rejects.toThrow("无权访问该小测记录");
  });

  it("persists topic practice and recomputes answers from the server bank", async () => {
    const question = topicQuizQuestions[0]!;
    const topicAttemptId = "00000000-0000-4000-8000-000000000060";
    const topicSet = database
      .select({ quizHash: quizSets.quizHash })
      .from(quizSets)
      .where(eq(quizSets.topicId, question.category))
      .get()!;

    const record = await store.saveAttempt({
      attemptId: topicAttemptId,
      learnerId,
      quizHash: topicSet.quizHash,
      topicId: question.category,
      passingScore: 80,
      answers: [
        {
          questionId: question.id,
          selectedAnswers: question.correctAnswers,
          isCorrect: false,
        },
      ],
    });

    expect(record).toMatchObject({
      id: topicAttemptId,
      learnerId,
      quizHash: topicSet.quizHash,
      topicId: question.category,
      correctCount: 1,
      totalQuestions: 1,
      score: 100,
      status: "passed",
      missedQuestionIds: [],
    });
    await expect(store.listAttempts(learnerId)).resolves.toContainEqual(
      record,
    );
    await expect(database.select().from(quizAttempts)).resolves.toHaveLength(1);
    await expect(database.select().from(quizAnswers)).resolves.toHaveLength(1);
    await expect(database.select().from(topicQuizAttempts)).resolves.toEqual([]);
    await expect(database.select().from(topicQuizAnswers)).resolves.toEqual([]);
  });

  it("keeps legacy topic attempts readable without writing new legacy rows", async () => {
    const legacyAttemptId = "00000000-0000-4000-8000-000000000070";
    await database.insert(topicQuizAttempts).values({
      id: legacyAttemptId,
      learnerId,
      topicId: "日常问答",
      quizHash: "f".repeat(64),
      status: "needs_retry",
      correctCount: 0,
      totalQuestions: 1,
      score: 0,
      completedAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    await database.insert(topicQuizAnswers).values({
      id: "00000000-0000-4000-8000-000000000071",
      topicQuizAttemptId: legacyAttemptId,
      questionKey: topicQuizQuestions[0]!.id,
      selectedAnswers: ["旧答案"],
      isCorrect: false,
      answeredAt: new Date("2026-08-01T00:00:00.000Z"),
    });

    await expect(store.listAttempts(learnerId)).resolves.toContainEqual(
      expect.objectContaining({
        id: legacyAttemptId,
        topicId: "日常问答",
        missedQuestionIds: [topicQuizQuestions[0]!.id],
      }),
    );
  });


  async function seedPublishedQuiz(): Promise<void> {
    await database.insert(users).values([
      {
        id: adminId,
        email: "admin@example.com",
        name: "管理员",
        passwordHash: "not-used",
        role: "admin" as const,
      },
      {
        id: learnerId,
        email: "learner@example.com",
        name: "学员",
        passwordHash: "not-used",
      },
      {
        id: otherLearnerId,
        email: "other@example.com",
        name: "其他学员",
        passwordHash: "not-used",
      },
    ]);
    await database.insert(knowledgeVersions).values({
      id: knowledgeVersionId,
      versionHash: "b".repeat(64),
      contentHash: "0".repeat(64),
      schemaVersion: 1,
      sourceRoot: "TOC售前客服知识库",
      status: "published",
      isActive: true,
      coverage: { sourceFiles: 8 },
      publishedAt: new Date(),
    });
    const unitRows = [
      {
        id: "00000000-0000-4000-8001-000000000001",
        unitKey: `ku_${"1".repeat(24)}`,
        title: "第一题",
        content: "答案一",
      },
      {
        id: "00000000-0000-4000-8001-000000000002",
        unitKey: `ku_${"2".repeat(24)}`,
        title: "第二题",
        content: "正确",
      },
    ].map((unit, index) => ({
      ...unit,
      knowledgeVersionId,
      categoryPath: ["产品"],
      contentHash: String(index + 1).repeat(64),
      sources: [
        {
                id: crypto.randomUUID(),
sourcePath: "企划问答.xlsx",
          kind: "excel" as const,
          anchor: `sheet:产品/row:${index + 2}`,
          sheet: "产品",
          row: index + 2,
          path: ["产品", unit.title],
        },
      ],
    }));
    await database.insert(knowledgeUnits).values(unitRows);
    await database.insert(quizSets).values({
      id: quizSetId,
      knowledgeVersionId,
      quizHash,
      contentHash: "1".repeat(64),
      sourceQuizHash: "c".repeat(64),
      title: "正式知识小测",
      status: "published",
      passingScore: 80,
      publishedAt: new Date(),
    });
    const questionRows = [
      {
        id: "00000000-0000-4000-8002-000000000001",
        knowledgeUnitId: unitRows[0]!.id,
        questionKey: firstQuestionKey,
        type: "single_choice" as const,
        prompt: "第一题",
        options: ["答案一", "答案二"],
        correctAnswers: ["答案一"],
      },
      {
        id: "00000000-0000-4000-8002-000000000002",
        knowledgeUnitId: unitRows[1]!.id,
        questionKey: secondQuestionKey,
        type: "true_false" as const,
        prompt: "第二题",
        options: ["正确", "错误"],
        correctAnswers: ["正确"],
      },
    ].map((question) => ({
      ...question,
      knowledgeVersionId,
      explanation: "解释",
      category: "日常问答",
      difficulty: "easy" as const,
      status: "published" as const,
      revision: 1,
      contentHash: `${question.id}-content`,
      knowledgeUnitKey: unitRows.find(
        (unit) => unit.id === question.knowledgeUnitId,
      )!.unitKey,
      sources: unitRows.find(
        (unit) => unit.id === question.knowledgeUnitId,
      )!.sources,
    }));
    await database.insert(questionCatalogs).values(
      questionRows.map((question) => ({
        id: `catalog-${question.id}`,
        stableKey: question.questionKey,
      })),
    );
    const revisionRows = questionRows.map((question) => ({
      ...question,
      questionCatalogId: `catalog-${question.id}`,
    }));
    await database.insert(questions).values(revisionRows);
    await database.insert(questionCatalogPublications).values(
      revisionRows.map((question) => ({
        catalogId: question.questionCatalogId,
        currentQuestionId: question.id,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })),
    );
    await database.insert(quizSetQuestions).values(
      revisionRows.map((question, position) => ({
        quizSetId,
        questionId: question.id,
        position,
        points: 1,
      })),
    );
  }
});
