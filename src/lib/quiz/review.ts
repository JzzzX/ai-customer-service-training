import { createHash } from "node:crypto";
import { z } from "zod";

import {
  quizDraftPackSchema,
  quizPublishedPackSchema,
  quizQuestionDraftSchema,
} from "./schema";
import type {
  QuizDraftPack,
  QuizPublishedPack,
  QuizQuestionDraft,
} from "./schema";

const quizQuestionReviewSchema = z.object({
  question: quizQuestionDraftSchema,
  decision: z.enum(["pending", "approved"]),
  reviewerId: z.string().trim().min(1).optional(),
});

export const quizReviewSchema = z.object({
  schemaVersion: z.literal(1),
  sourceQuizHash: z.string().regex(/^[a-f0-9]{64}$/),
  knowledgePackHash: z.string().regex(/^[a-f0-9]{64}$/),
  title: z.string().trim().min(1),
  passingScore: z.number().int().min(0).max(100),
  questions: z.array(quizQuestionReviewSchema).min(1),
});

export type QuizReview = z.infer<typeof quizReviewSchema>;

interface ApproveQuizQuestionInput {
  questionId: string;
  reviewerId: string;
  changes?: {
    prompt?: string;
    options?: string[];
    correctAnswer?: string;
    explanation?: string;
    category?: string;
    difficulty?: QuizQuestionDraft["difficulty"];
  };
}

export function createQuizReview(pack: QuizDraftPack): QuizReview {
  const draft = quizDraftPackSchema.parse(pack);
  return quizReviewSchema.parse({
    schemaVersion: 1,
    sourceQuizHash: draft.quizHash,
    knowledgePackHash: draft.knowledgePackHash,
    title: draft.title,
    passingScore: draft.passingScore,
    questions: draft.questions.map((question) => ({
      question,
      decision: "pending",
    })),
  });
}

export function approveQuizQuestion(
  review: QuizReview,
  input: ApproveQuizQuestionInput,
): QuizReview {
  const current = quizReviewSchema.parse(review);
  const questionIndex = current.questions.findIndex(
    (item) => item.question.id === input.questionId,
  );
  if (questionIndex < 0) {
    throw new Error(`找不到待审核题目：${input.questionId}`);
  }

  const existing = current.questions[questionIndex]!.question;
  const options = (input.changes?.options ?? existing.options).map((option) =>
    option.trim(),
  );
  const correctAnswer = (
    input.changes?.correctAnswer ??
    existing.correctAnswers[0] ??
    ""
  ).trim();

  if (new Set(options).size !== options.length) {
    throw new Error("题目选项不能重复。");
  }
  if (!options.includes(correctAnswer)) {
    throw new Error("正确答案必须存在于选项中。");
  }
  if (
    existing.type === "true_false" &&
    (options.length !== 2 ||
      !options.includes("正确") ||
      !options.includes("错误"))
  ) {
    throw new Error("判断题选项必须为“正确”和“错误”。");
  }

  const updatedQuestion = quizQuestionDraftSchema.parse({
    ...existing,
    prompt: input.changes?.prompt ?? existing.prompt,
    options,
    correctAnswers: [correctAnswer],
    explanation: input.changes?.explanation ?? existing.explanation,
    category: input.changes?.category ?? existing.category,
    difficulty: input.changes?.difficulty ?? existing.difficulty,
  });
  const questions = [...current.questions];
  questions[questionIndex] = {
    question: updatedQuestion,
    decision: "approved",
    reviewerId: input.reviewerId,
  };

  return quizReviewSchema.parse({ ...current, questions });
}

export function publishQuizReview(review: QuizReview): QuizPublishedPack {
  const current = quizReviewSchema.parse(review);
  const pendingCount = current.questions.filter(
    (item) => item.decision !== "approved",
  ).length;
  if (pendingCount > 0) {
    throw new Error(`还有 ${pendingCount} 道题未审核，不能发布。`);
  }

  const payload = {
    schemaVersion: 1 as const,
    sourceQuizHash: current.sourceQuizHash,
    knowledgePackHash: current.knowledgePackHash,
    title: current.title,
    passingScore: current.passingScore,
    status: "published" as const,
    questions: current.questions.map((item) => ({
      ...item.question,
      status: "published" as const,
    })),
  };

  return quizPublishedPackSchema.parse({
    ...payload,
    quizHash: digest(payload),
  });
}

export function hashQuizQuestion(question: QuizQuestionDraft): string {
  return digest(quizQuestionDraftSchema.parse(question));
}

function digest(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}
