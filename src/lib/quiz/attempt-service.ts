import { getQuizAttemptStore } from "@/lib/runtime/services";

import type {
  QuizAttemptRecord,
  SaveQuizAttemptInput,
} from "./attempt-store";
import { quizTopics, topicQuizQuestions } from "./question-bank";
import {
  summarizeQuizProgress,
  type QuizProgressSummary,
} from "./progress";

export async function saveQuizAttemptForLearner(
  input: SaveQuizAttemptInput,
): Promise<QuizAttemptRecord> {
  return getQuizAttemptStore().saveAttempt(input);
}

export async function listQuizAttemptsForLearner(
  learnerId: string,
): Promise<QuizAttemptRecord[]> {
  return getQuizAttemptStore().listAttempts(learnerId);
}

export async function getQuizProgressForLearner(
  learnerId: string,
  options: { recentLimit?: number } = {},
): Promise<QuizProgressSummary> {
  const attempts = await listQuizAttemptsForLearner(learnerId);
  const totals = new Map<string, number>();
  for (const question of topicQuizQuestions) {
    totals.set(question.category, (totals.get(question.category) ?? 0) + 1);
  }
  return summarizeQuizProgress(
    attempts,
    quizTopics.map((topic) => ({
      id: topic.id,
      totalQuestions: totals.get(topic.id) ?? 0,
    })),
    options.recentLimit,
  );
}
