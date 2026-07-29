import { join } from "node:path";

import { shouldUseLocalTestAccounts } from "@/lib/auth/local-test-accounts";

import { LocalQuizReviewStore } from "./local-review-store";
import type { QuizReview } from "./review";
import type {
  QuizPublishedPack,
  QuizQuestionDraft,
} from "./schema";

type QuestionChanges = {
  prompt?: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  category?: string;
  difficulty?: QuizQuestionDraft["difficulty"];
};

export async function loadQuizReview(): Promise<QuizReview> {
  return getLocalStore().loadReview();
}

export async function approveQuizQuestionForAdmin(input: {
  questionId: string;
  reviewerId: string;
  changes?: QuestionChanges;
}): Promise<QuizReview> {
  return getLocalStore().approveQuestion(input);
}

export async function publishQuizForLearners(): Promise<QuizPublishedPack> {
  return getLocalStore().publish();
}

export async function loadPublishedQuiz(): Promise<QuizPublishedPack | null> {
  return getLocalStore().loadPublished();
}

function getLocalStore(): LocalQuizReviewStore {
  if (!shouldUseLocalTestAccounts()) {
    throw new Error(
      "本地审题功能只在本地测试账号模式可用；Neon题库适配将在后续接入。",
    );
  }
  return new LocalQuizReviewStore(
    join(process.cwd(), "artifacts", "quiz"),
  );
}
