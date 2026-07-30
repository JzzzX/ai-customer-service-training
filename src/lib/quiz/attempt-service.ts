import { getQuizAttemptStore } from "@/lib/runtime/services";

import type {
  QuizAttemptRecord,
  SaveQuizAttemptInput,
} from "./attempt-store";

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
