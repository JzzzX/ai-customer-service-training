import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import { LocalQuizReviewStore } from "./local-review-store";
import { publishQuizDraftPack } from "./publisher";
import type { QuizDraftPack, QuizQuestionDraft } from "./schema";

function question(idDigit: string): QuizQuestionDraft {
  return {
    id: `qq_${idDigit.repeat(24)}`,
    knowledgeUnitId: `ku_${idDigit.repeat(24)}`,
    type: "single_choice",
    prompt: `问题${idDigit}`,
    options: ["正确答案", "错误答案"],
    correctAnswers: ["正确答案"],
    explanation: `解释${idDigit}`,
    category: "日常问答",
    difficulty: "easy",
    status: "draft",
    sources: [
      {
        sourcePath: "问答.md",
        kind: "markdown",
        anchor: `heading:${idDigit}`,
        line: Number(idDigit),
        path: ["问答", `问题${idDigit}`],
      },
    ],
  };
}

function draftPack(): QuizDraftPack {
  return {
    schemaVersion: 1,
    quizHash: "a".repeat(64),
    knowledgePackHash: "b".repeat(64),
    title: "客服新人知识基础小测",
    passingScore: 80,
    status: "draft",
    questions: [question("1"), question("2")],
  };
}

describe("LocalQuizReviewStore", () => {
  let outputDir: string;
  let store: LocalQuizReviewStore;

  beforeEach(async () => {
    outputDir = await mkdtemp(join(tmpdir(), "quiz-review-store-"));
    await publishQuizDraftPack({ pack: draftPack(), outputDir });
    store = new LocalQuizReviewStore(outputDir);
  });

  it("loads the latest generated draft as a pending review queue", async () => {
    const review = await store.loadReview();

    expect(review.questions).toHaveLength(2);
    expect(review.questions.every((item) => item.decision === "pending")).toBe(
      true,
    );
  });

  it("persists an approved edit across store instances", async () => {
    await store.approveQuestion({
      questionId: `qq_${"1".repeat(24)}`,
      reviewerId: "admin-1",
      changes: {
        prompt: "审核后的题干",
      },
    });

    const reloaded = await new LocalQuizReviewStore(outputDir).loadReview();
    expect(reloaded.questions[0]).toMatchObject({
      decision: "approved",
      question: { prompt: "审核后的题干" },
    });
  });

  it("publishes only after all questions are approved and can reload the result", async () => {
    await expect(store.publish()).rejects.toThrow("还有 2 道题未审核");

    for (const item of (await store.loadReview()).questions) {
      await store.approveQuestion({
        questionId: item.question.id,
        reviewerId: "admin-1",
      });
    }

    const published = await store.publish();
    const reloaded = await new LocalQuizReviewStore(
      outputDir,
    ).loadPublished();

    expect(published.status).toBe("published");
    expect(reloaded).toEqual(published);
  });
});
