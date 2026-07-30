import { join } from "node:path";

import { getDatabase, type DatabaseClient } from "@/db/client";
import { DbQuizReviewStore } from "@/db/repositories/db-quiz-review-store";
import { shouldUseLocalTestAccounts } from "@/lib/auth/local-test-accounts";
import { LocalQuizReviewStore } from "@/lib/quiz/local-review-store";
import type { QuizReviewStore } from "@/lib/quiz/review-store";

type Environment = Record<string, string | undefined>;

type QuizReviewCompositionInput = {
  environment: Environment;
  nodeEnvironment: "development" | "production" | "test" | undefined;
  projectRoot: string;
  databaseFactory: () => DatabaseClient;
};

export function createQuizReviewStore(
  input: QuizReviewCompositionInput,
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

export function getQuizReviewStore(): QuizReviewStore {
  return createQuizReviewStore({
    environment: process.env,
    nodeEnvironment: process.env.NODE_ENV,
    projectRoot: process.cwd(),
    databaseFactory: getDatabase,
  });
}
