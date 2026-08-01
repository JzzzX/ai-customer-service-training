import { describe, expect, it } from "vitest";

import {
  approveQuizQuestion,
  createQuizReview,
  publishQuizReview,
} from "./review";
import type { QuizDraftPack, QuizQuestionDraft } from "./schema";

function question(
  idDigit: string,
  overrides: Partial<QuizQuestionDraft> = {},
): QuizQuestionDraft {
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
    ...overrides,
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

describe("quiz review", () => {
  it("starts every generated question in a pending review state", () => {
    const review = createQuizReview(draftPack());

    expect(review.sourceQuizHash).toBe("a".repeat(64));
    expect(review.questions.map((item) => item.decision)).toEqual([
      "pending",
      "pending",
    ]);
  });

  it("approves an edited question without allowing its knowledge source to change", () => {
    const review = createQuizReview(draftPack());
    const originalSource = review.questions[0]?.question.sources;
    const approved = approveQuizQuestion(review, {
      questionId: `qq_${"1".repeat(24)}`,
      reviewerId: "admin-1",
      changes: {
        prompt: "编辑后的清晰题干",
        options: ["标准答案", "干扰答案"],
        correctAnswer: "标准答案",
        explanation: "编辑后的答案解释",
      },
    });

    expect(approved.questions[0]).toMatchObject({
      decision: "approved",
      reviewerId: "admin-1",
      question: {
        prompt: "编辑后的清晰题干",
        correctAnswers: ["标准答案"],
        status: "draft",
      },
    });
    expect(approved.questions[0]?.question.sources).toEqual(originalSource);
  });

  it("rejects edits whose correct answer is absent from the options", () => {
    expect(() =>
      approveQuizQuestion(createQuizReview(draftPack()), {
        questionId: `qq_${"1".repeat(24)}`,
        reviewerId: "admin-1",
        changes: {
          options: ["A", "B"],
          correctAnswer: "C",
        },
      }),
    ).toThrow("正确答案必须存在于选项中");
  });

  it("blocks publication until every question is approved", () => {
    const review = approveQuizQuestion(createQuizReview(draftPack()), {
      questionId: `qq_${"1".repeat(24)}`,
      reviewerId: "admin-1",
    });

    expect(() => publishQuizReview(review)).toThrow("还有 1 道题未审核");
  });

  it("auto-publishes a generated draft when manual review is waived", () => {
    const published = publishQuizReview(createQuizReview(draftPack()), {
      requireApproval: false,
    });

    expect(published.status).toBe("published");
    expect(published.questions).toHaveLength(2);
    expect(
      published.questions.every((item) => item.status === "published"),
    ).toBe(true);
  });

  it("publishes an immutable source-bound pack after complete review", () => {
    let review = createQuizReview(draftPack());
    for (const item of review.questions) {
      review = approveQuizQuestion(review, {
        questionId: item.question.id,
        reviewerId: "admin-1",
      });
    }

    const published = publishQuizReview(review);

    expect(published.status).toBe("published");
    expect(published.questions).toHaveLength(2);
    expect(
      published.questions.every(
        (item) => item.status === "published" && item.sources.length > 0,
      ),
    ).toBe(true);
    expect(published.quizHash).not.toBe(review.sourceQuizHash);
  });
});
