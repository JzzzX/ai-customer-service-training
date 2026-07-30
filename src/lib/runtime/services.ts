import { join } from "node:path";

import { getDatabase, type DatabaseClient } from "@/db/client";
import { DbQuizAttemptStore } from "@/db/repositories/db-quiz-attempt-store";
import { DbQuizReviewStore } from "@/db/repositories/db-quiz-review-store";
import { shouldUseLocalTestAccounts } from "@/lib/auth/local-test-accounts";
import { LocalQuizAttemptStore } from "@/lib/quiz/local-attempt-store";
import { LocalQuizReviewStore } from "@/lib/quiz/local-review-store";
import type { QuizAttemptStore } from "@/lib/quiz/attempt-store";
import type { QuizReviewStore } from "@/lib/quiz/review-store";

type Environment = Record<string, string | undefined>;

type StoreCompositionInput = {
  environment: Environment;
  nodeEnvironment: "development" | "production" | "test" | undefined;
  projectRoot: string;
  databaseFactory: () => DatabaseClient;
};

export function createQuizReviewStore(
  input: StoreCompositionInput,
): QuizReviewStore {
  if (
    shouldUseLocalTestAccounts(
      input.environment,
      input.nodeEnvironment,
    )
  ) {
    return new LocalQuizReviewStore(
      join(input.projectRoot, "artifacts", "quiz"),
    );
  }
  return new DbQuizReviewStore(input.databaseFactory());
}

export function createQuizAttemptStore(
  input: StoreCompositionInput,
): QuizAttemptStore {
  if (
    shouldUseLocalTestAccounts(
      input.environment,
      input.nodeEnvironment,
    )
  ) {
    return new LocalQuizAttemptStore(
      join(input.projectRoot, "artifacts", "quiz"),
    );
  }
  return new DbQuizAttemptStore(input.databaseFactory());
}

export function getQuizReviewStore(): QuizReviewStore {
  return createQuizReviewStore({
    environment: process.env,
    nodeEnvironment: process.env.NODE_ENV,
    projectRoot: process.cwd(),
    databaseFactory: getDatabase,
  });
}

export function getQuizAttemptStore(): QuizAttemptStore {
  return createQuizAttemptStore({
    environment: process.env,
    nodeEnvironment: process.env.NODE_ENV,
    projectRoot: process.cwd(),
    databaseFactory: getDatabase,
  });
}
