import { join } from "node:path";

import { shouldUseLocalTestAccounts } from "@/lib/auth/local-test-accounts";

import {
  LocalQuizAttemptStore,
  type QuizAttemptRecord,
} from "./local-attempt-store";

type SaveQuizAttemptInput = {
  learnerId: string;
  quizHash: string;
  passingScore: number;
  correctCount: number;
  totalQuestions: number;
  missedQuestionIds: string[];
};

export async function saveQuizAttemptForLearner(
  input: SaveQuizAttemptInput,
): Promise<QuizAttemptRecord> {
  return getLocalStore().saveAttempt(input);
}

export async function listQuizAttemptsForLearner(
  learnerId: string,
): Promise<QuizAttemptRecord[]> {
  return getLocalStore().listAttempts(learnerId);
}

function getLocalStore(): LocalQuizAttemptStore {
  if (!shouldUseLocalTestAccounts()) {
    throw new Error(
      "本地练习记录只在本地测试账号模式可用；正式账号存储适配将在飞书身份方案确定后接入。",
    );
  }
  return new LocalQuizAttemptStore(
    join(process.cwd(), "artifacts", "quiz"),
  );
}
