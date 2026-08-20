import {
  getPublishedQuizStore,
  getQuizAttemptStore,
} from "@/lib/runtime/services";

import type {
  QuizAttemptRecord,
  SaveQuizAttemptInput,
} from "./attempt-store";
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
  const topics = await getPublishedQuizStore().listPublishedTopics();
  return summarizeQuizProgress(
    attempts,
    topics.map((topic) => ({
      id: topic.topicId,
      totalQuestions: topic.questionCount,
    })),
    options.recentLimit,
  );
}
