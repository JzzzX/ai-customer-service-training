import { join } from "node:path";

import { getDatabase, type DatabaseClient } from "@/db/client";
import { DbQuizAttemptStore } from "@/db/repositories/db-quiz-attempt-store";
import { DbQuizReviewStore } from "@/db/repositories/db-quiz-review-store";
import { DbAssignmentStore } from "@/db/repositories/db-assignment-store";
import { DbReviewStore } from "@/db/repositories/db-review-store";
import { DbScenarioSessionStore } from "@/db/repositories/db-scenario-session-store";
import { DbScenarioTemplateStore } from "@/db/repositories/db-scenario-template-store";
import { DbTrainingCatalogStore } from "@/db/repositories/db-training-catalog-store";
import { DbKnowledgeQueryStore } from "@/db/repositories/db-knowledge-query-store";
import { LocalQuizAttemptStore } from "@/lib/quiz/local-attempt-store";
import { LocalQuizReviewStore } from "@/lib/quiz/local-review-store";
import type { QuizAttemptStore } from "@/lib/quiz/attempt-store";
import type { QuizReviewStore } from "@/lib/quiz/review-store";
import { LocalScenarioSessionStore } from "@/lib/scenario/local-session-store";
import {
  MockConversationProvider,
  MockEvaluationProvider,
  MockLiveRiskProvider,
} from "@/lib/scenario/mock-providers";
import { createOpenAIProviders } from "@/lib/scenario/ai-providers";
import {
  getOpenAIClient,
  isAiGatewayEnabled,
  resolveOpenAiModel,
  resolveScenarioAiMode,
} from "@/lib/scenario/ai-client";
import type { ScenarioTemplateStore } from "@/lib/scenario/template-store";
import { ScenarioTrainingService } from "@/lib/scenario/training-service";
import {
  getScenarioTemplate,
  scenarioTemplates,
} from "@/lib/scenario/templates";
import {
  EmptyKnowledgeQueryStore,
  type KnowledgeQueryStore,
} from "@/lib/knowledge/query-store";
import { AssignmentService } from "@/lib/training/assignment-service";
import type { AssignmentStore } from "@/lib/training/assignment-store";
import {
  EmptyTrainingCatalogStore,
  type TrainingCatalogStore,
} from "@/lib/training/catalog-store";
import {
  LocalReadonlyAssignmentStore,
  LocalReadonlyReviewStore,
} from "@/lib/training/local-readonly-stores";
import { ReviewService } from "@/lib/training/review-service";
import type { ReviewStore } from "@/lib/training/review-store";

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

export function createAssignmentStore(
  input: StoreCompositionInput,
): AssignmentStore {
  if (runtimeMode(input) === "local_demo") {
    return new LocalReadonlyAssignmentStore();
  }
  return new DbAssignmentStore(input.databaseFactory());
}

export function createReviewStore(
  input: StoreCompositionInput,
): ReviewStore {
  if (runtimeMode(input) === "local_demo") {
    return new LocalReadonlyReviewStore();
  }
  return new DbReviewStore(input.databaseFactory());
}

export function createTrainingCatalogStore(
  input: StoreCompositionInput,
): TrainingCatalogStore {
  if (runtimeMode(input) === "local_demo") {
    return new EmptyTrainingCatalogStore();
  }
  return new DbTrainingCatalogStore(input.databaseFactory());
}

export function createKnowledgeQueryStore(
  input: StoreCompositionInput,
): KnowledgeQueryStore {
  if (runtimeMode(input) === "local_demo") {
    return new EmptyKnowledgeQueryStore();
  }
  return new DbKnowledgeQueryStore(input.databaseFactory());
}

export function createAssignmentService(
  input: StoreCompositionInput,
): AssignmentService {
  return new AssignmentService(createAssignmentStore(input));
}

export function createReviewService(
  input: StoreCompositionInput,
): ReviewService {
  return new ReviewService(createReviewStore(input));
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

export function getAssignmentService(): AssignmentService {
  return createAssignmentService(defaultCompositionInput());
}

export function getReviewService(): ReviewService {
  return createReviewService(defaultCompositionInput());
}

export function getTrainingCatalogStore(): TrainingCatalogStore {
  return createTrainingCatalogStore(defaultCompositionInput());
}

export function getKnowledgeQueryStore(): KnowledgeQueryStore {
  return createKnowledgeQueryStore(defaultCompositionInput());
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
  const aiMode = resolveScenarioAiMode(input.environment);
  const useRealAi = aiMode === "real";
  const providers = useRealAi
    ? createOpenAIProviders(
        getOpenAIClient(input.environment),
        resolveOpenAiModel(input.environment),
        {
          useDoubaoThinking: !isAiGatewayEnabled(input.environment),
        },
      )
    : {
        conversation: new MockConversationProvider(),
        evaluation: new MockEvaluationProvider(),
        liveRisk: new MockLiveRiskProvider(),
      };

  return new ScenarioTrainingService({
    store: isLocal
      ? new LocalScenarioSessionStore(
          join(input.projectRoot, "artifacts", "scenario"),
        )
      : new DbScenarioSessionStore(database!),
    templates,
    conversationProvider: providers.conversation,
    evaluationProvider: providers.evaluation,
    liveRiskProvider: providers.liveRisk,
    mode: aiMode,
    knowledgeUnitLoader: async (scenario) => {
      const queryStore = isLocal
        ? new EmptyKnowledgeQueryStore()
        : new DbKnowledgeQueryStore(database!);
      return queryStore.listUnitsForScenario(scenario.category);
    },
  });
}

export function getScenarioAiMode() {
  return resolveScenarioAiMode(process.env);
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
  return createScenarioTrainingService(defaultCompositionInput());
}

export function getScenarioTemplateStore(): ScenarioTemplateStore {
  return createScenarioTemplateStore(defaultCompositionInput());
}

function defaultCompositionInput(): StoreCompositionInput {
  return {
    environment: process.env,
    nodeEnvironment: process.env.NODE_ENV,
    projectRoot: process.cwd(),
    databaseFactory: getDatabase,
  };
}

function runtimeMode(input: StoreCompositionInput) {
  return resolveRuntimeMode({
    ...input.environment,
    NODE_ENV: input.nodeEnvironment,
  });
}
