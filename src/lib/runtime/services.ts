import { join } from "node:path";

import { getDatabase, type DatabaseClient } from "@/db/client";
import { DbQuizAttemptStore } from "@/db/repositories/db-quiz-attempt-store";
import { DbQuizReviewStore } from "@/db/repositories/db-quiz-review-store";
import { DbScenarioSessionStore } from "@/db/repositories/db-scenario-session-store";
import { DbScenarioTemplateStore } from "@/db/repositories/db-scenario-template-store";
import { LocalQuizAttemptStore } from "@/lib/quiz/local-attempt-store";
import { LocalQuizReviewStore } from "@/lib/quiz/local-review-store";
import type { QuizAttemptStore } from "@/lib/quiz/attempt-store";
import type { QuizReviewStore } from "@/lib/quiz/review-store";
import { LocalScenarioSessionStore } from "@/lib/scenario/local-session-store";
import {
  MockConversationProvider,
  MockEvaluationProvider,
} from "@/lib/scenario/mock-providers";
import type { ScenarioTemplateStore } from "@/lib/scenario/template-store";
import { ScenarioTrainingService } from "@/lib/scenario/training-service";
import {
  getScenarioTemplate,
  scenarioTemplates,
} from "@/lib/scenario/templates";

import { resolveRuntimeMode } from "./mode";

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
  if (runtimeMode(input) === "local_demo") {
    return new LocalQuizReviewStore(
      join(input.projectRoot, "artifacts", "quiz"),
    );
  }
  return new DbQuizReviewStore(input.databaseFactory());
}

export function createQuizAttemptStore(
  input: StoreCompositionInput,
): QuizAttemptStore {
  if (runtimeMode(input) === "local_demo") {
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

export function createScenarioTrainingService(
  input: StoreCompositionInput,
): ScenarioTrainingService {
  const isLocal = runtimeMode(input) === "local_demo";
  const database = isLocal ? null : input.databaseFactory();
  const templates = createScenarioTemplateStore({
    ...input,
    databaseFactory: () => database!,
  });

  return new ScenarioTrainingService({
    store: isLocal
      ? new LocalScenarioSessionStore(
          join(input.projectRoot, "artifacts", "scenario"),
        )
      : new DbScenarioSessionStore(database!),
    templates,
    conversationProvider: new MockConversationProvider(),
    evaluationProvider: new MockEvaluationProvider(),
  });
}

export function createScenarioTemplateStore(
  input: StoreCompositionInput,
): ScenarioTemplateStore {
  if (runtimeMode(input) === "local_demo") {
    return {
      async listPublished() {
        return scenarioTemplates;
      },
      async getPublishedById(scenarioId) {
        return getScenarioTemplate(scenarioId) ?? null;
      },
    };
  }
  return new DbScenarioTemplateStore(input.databaseFactory());
}

export function getScenarioTrainingService(): ScenarioTrainingService {
  return createScenarioTrainingService({
    environment: process.env,
    nodeEnvironment: process.env.NODE_ENV,
    projectRoot: process.cwd(),
    databaseFactory: getDatabase,
  });
}

export function getScenarioTemplateStore(): ScenarioTemplateStore {
  return createScenarioTemplateStore({
    environment: process.env,
    nodeEnvironment: process.env.NODE_ENV,
    projectRoot: process.cwd(),
    databaseFactory: getDatabase,
  });
}

function runtimeMode(input: StoreCompositionInput) {
  return resolveRuntimeMode({
    ...input.environment,
    NODE_ENV: input.nodeEnvironment,
  });
}
