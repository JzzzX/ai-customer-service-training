import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DbQuizReviewStore } from "./db-quiz-review-store";
import type { DatabaseClient } from "../client";
import {
  knowledgeUnits,
  knowledgeVersions,
  questionReviews,
  questions,
  quizSetQuestions,
  quizSets,
  users,
} from "../schema";
import { createTestDatabase } from "../test-support/create-test-database";
import { hashQuizQuestion } from "@/lib/quiz/review";

const adminId = "00000000-0000-4000-8000-000000000001";
const knowledgeVersionId =
  "00000000-0000-4000-8000-000000000020";
const quizSetId = "00000000-0000-4000-8000-000000000030";
const sourceQuizHash = "a".repeat(64);
const knowledgePackHash = "b".repeat(64);

describe("DbQuizReviewStore", () => {
  let client: Awaited<
    ReturnType<typeof createTestDatabase>
  >["client"];
  let database: Awaited<
    ReturnType<typeof createTestDatabase>
  >["database"];
  let store: DbQuizReviewStore;

  beforeEach(async () => {
    ({ client, database } = await createTestDatabase());
    await seedDraft();
    store = new DbQuizReviewStore(
      database as unknown as DatabaseClient,
    );
  });

  afterEach(async () => {
    await client.close();
  });

  it("loads the current draft in position order with database sources", async () => {
    const review = await store.loadReview();

    expect(review.sourceQuizHash).toBe(sourceQuizHash);
    expect(review.knowledgePackHash).toBe(knowledgePackHash);
    expect(review.questions).toHaveLength(40);
    expect(review.questions[0]?.question.id).toBe(
      `qq_${"0".repeat(24)}`,
    );
    expect(review.questions[0]?.question.sources).toEqual([
      {
        sourcePath: "企划问答.xlsx",
        kind: "excel",
        anchor: "sheet:产品/row:2",
        sheet: "产品",
        row: 2,
        path: ["产品", "第 1 题"],
      },
    ]);
    expect(review.questions[0]?.decision).toBe("pending");
  });

  it("updates a question and appends a content-hash approval record", async () => {
    const questionId = `qq_${"0".repeat(24)}`;
    const review = await store.approveQuestion({
      questionId,
      reviewerId: adminId,
      changes: { prompt: "已由知识负责人核对的题目" },
    });

    expect(review.questions[0]).toMatchObject({
      decision: "approved",
      reviewerId: adminId,
      question: { prompt: "已由知识负责人核对的题目" },
    });
    const storedReviews = await database
      .select()
      .from(questionReviews);
    expect(storedReviews).toHaveLength(1);
    expect(storedReviews[0]?.contentHash).toBe(
      hashQuizQuestion(review.questions[0]!.question),
    );
    expect(storedReviews[0]?.snapshot.prompt).toBe(
      "已由知识负责人核对的题目",
    );
  });

  it("keeps old audit rows but only trusts the current question hash", async () => {
    const questionId = `qq_${"0".repeat(24)}`;
    await store.approveQuestion({
      questionId,
      reviewerId: adminId,
    });
    const changed = await store.approveQuestion({
      questionId,
      reviewerId: adminId,
      changes: { prompt: "第二次核对后的题目" },
    });

    const rows = await database.select().from(questionReviews);
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.contentHash)).size).toBe(2);
    expect(changed.questions[0]?.decision).toBe("approved");

    await database
      .update(questions)
      .set({ prompt: "未审核的外部改动" })
      .where(eq(questions.questionKey, questionId));
    const reloaded = await store.loadReview();
    expect(reloaded.questions[0]?.decision).toBe("pending");
  });

  it("refuses publication while any current question hash is pending", async () => {
    await store.approveQuestion({
      questionId: `qq_${"0".repeat(24)}`,
      reviewerId: adminId,
    });

    await expect(store.publish()).rejects.toThrow(
      "还有 39 道题未审核",
    );
  });

  it("publishes one immutable set and returns it on repeated publish", async () => {
    const review = await store.loadReview();
    const questionRows = await database
      .select({ id: questions.id, questionKey: questions.questionKey })
      .from(questions);
    const idByKey = new Map(
      questionRows.map((question) => [
        question.questionKey,
        question.id,
      ]),
    );
    await database.insert(questionReviews).values(
      review.questions.map((item) => ({
        questionId: idByKey.get(item.question.id)!,
        reviewerId: adminId,
        contentHash: hashQuizQuestion(item.question),
        snapshot: item.question,
      })),
    );

    const first = await store.publish();
    const second = await store.publish();
    const publishedRows = await database
      .select()
      .from(quizSets)
      .where(eq(quizSets.status, "published"));

    expect(second).toEqual(first);
    expect(first.status).toBe("published");
    expect(first.questions).toHaveLength(40);
    expect(publishedRows).toHaveLength(1);
    await expect(store.loadPublished()).resolves.toEqual(first);
  });

  async function seedDraft(): Promise<void> {
    await database.insert(users).values({
      id: adminId,
      email: "admin@example.com",
      name: "管理员",
      passwordHash: "not-used-in-test",
      role: "admin",
    });
    await database.insert(knowledgeVersions).values({
      id: knowledgeVersionId,
      versionHash: knowledgePackHash,
      schemaVersion: 1,
      sourceRoot: "TOC售前客服知识库",
      status: "published",
      isActive: true,
      coverage: { sourceFiles: 8 },
      publishedAt: new Date("2026-07-30T00:00:00.000Z"),
      createdById: adminId,
    });

    const units = Array.from({ length: 40 }, (_, index) => {
      const suffix = index.toString(16).padStart(24, "0");
      return {
        id: `00000000-0000-4000-8001-${index
          .toString()
          .padStart(12, "0")}`,
        knowledgeVersionId,
        unitKey: `ku_${suffix}`,
        title: `第 ${index + 1} 题`,
        content: `第 ${index + 1} 题答案`,
        categoryPath: ["产品"],
        contentHash: index.toString(16).padStart(64, "0"),
        sources: [
          {
            sourcePath: "企划问答.xlsx",
            kind: "excel" as const,
            anchor: `sheet:产品/row:${index + 2}`,
            sheet: "产品",
            row: index + 2,
            path: ["产品", `第 ${index + 1} 题`],
          },
        ],
      };
    });
    await database.insert(knowledgeUnits).values(units);
    await database.insert(quizSets).values({
      id: quizSetId,
      knowledgeVersionId,
      quizHash: sourceQuizHash,
      title: "客服新人知识基础小测",
      status: "draft",
      passingScore: 80,
      createdById: adminId,
    });
    const questionRows = Array.from({ length: 40 }, (_, index) => {
      const suffix = index.toString(16).padStart(24, "0");
      return {
        id: `00000000-0000-4000-8002-${index
          .toString()
          .padStart(12, "0")}`,
        knowledgeVersionId,
        knowledgeUnitId: units[index]!.id,
        questionKey: `qq_${suffix}`,
        type:
          index < 20
            ? ("single_choice" as const)
            : ("true_false" as const),
        prompt: `第 ${index + 1} 题`,
        options:
          index < 20 ? ["正确答案", "干扰项"] : ["正确", "错误"],
        correctAnswers: [index < 20 ? "正确答案" : "正确"],
        explanation: `第 ${index + 1} 题答案`,
        category: "产品属性及卖点",
        difficulty: "easy" as const,
        status: "draft" as const,
        createdById: adminId,
      };
    });
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
