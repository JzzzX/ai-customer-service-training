import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DbQuizAttemptStore } from "./db-quiz-attempt-store";
import type { DatabaseClient } from "../client";
import {
  assignments,
  knowledgeUnits,
  knowledgeVersions,
  questions,
  quizAnswers,
  quizAttempts,
  quizSetQuestions,
  quizSets,
  users,
} from "../schema";
import { createTestDatabase } from "../test-support/create-test-database";

const adminId = "00000000-0000-4000-8000-000000000001";
const learnerId = "00000000-0000-4000-8000-000000000002";
const otherLearnerId =
  "00000000-0000-4000-8000-000000000003";
const knowledgeVersionId =
  "00000000-0000-4000-8000-000000000020";
const quizSetId = "00000000-0000-4000-8000-000000000030";
const assignmentId = "00000000-0000-4000-8000-000000000040";
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

  it("completes only the matching learner assignment", async () => {
    await database.insert(assignments).values({
      id: assignmentId,
      learnerId,
      assignedById: adminId,
      assignmentType: "quiz",
      quizSetId,
      status: "assigned",
    });

    await store.saveAttempt({
      attemptId,
      learnerId,
      quizHash,
      assignmentId,
      passingScore: 80,
      answers: [
        {
          questionId: firstQuestionKey,
          selectedAnswers: ["答案一"],
          isCorrect: true,
        },
      ],
    });

    const [assignment] = await database
      .select()
      .from(assignments)
      .where(eq(assignments.id, assignmentId));
    expect(assignment).toMatchObject({
      status: "completed",
      learnerId,
      quizSetId,
    });
    expect(assignment?.completedAt).toBeInstanceOf(Date);
  });

  async function seedPublishedQuiz(): Promise<void> {
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
      versionHash: "b".repeat(64),
      schemaVersion: 1,
      sourceRoot: "TOC售前客服知识库",
      status: "published",
      isActive: true,
      coverage: { sourceFiles: 8 },
      publishedAt: new Date(),
      createdById: adminId,
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
      sourceQuizHash: "c".repeat(64),
      title: "正式知识小测",
      status: "published",
      passingScore: 80,
      publishedAt: new Date(),
      createdById: adminId,
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
      createdById: adminId,
    }));
    await database.insert(questions).values(questionRows);
    await database.insert(quizSetQuestions).values(
      questionRows.map((question, position) => ({
        quizSetId,
        questionId: question.id,
        position,
        points: 1,
      })),
    );
  }
});
