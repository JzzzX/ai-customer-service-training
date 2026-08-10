import { getQuizReviewStore } from "@/lib/runtime/services";

import type { QuizReview } from "./review";
import type { QuizQuestionChanges } from "./review-store";
import type { QuizPublishedPack } from "./schema";

export async function loadQuizReview(): Promise<QuizReview> {
  return getQuizReviewStore().loadReview();
}

export async function approveQuizQuestionForAdmin(input: {
  questionId: string;
  reviewerId: string;
  changes?: QuizQuestionChanges;
}): Promise<QuizReview> {
  return getQuizReviewStore().approveQuestion(input);
}

export async function publishQuizForLearners(): Promise<QuizPublishedPack> {
  return getQuizReviewStore().publish();
}

export async function loadPublishedQuiz(): Promise<QuizPublishedPack | null> {
  return getQuizReviewStore().loadPublished();
}
