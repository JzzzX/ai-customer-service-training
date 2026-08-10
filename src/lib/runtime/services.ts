import { join } from "node:path";

import { getDatabase, type DatabaseClient } from "@/db/client";
import { DbQuizAttemptStore } from "@/db/repositories/db-quiz-attempt-store";
import { DbPublishedQuizStore } from "@/db/repositories/db-published-quiz-store";
import { DbScenarioSessionStore } from "@/db/repositories/db-scenario-session-store";
import { DbScenarioTemplateStore } from "@/db/repositories/db-scenario-template-store";
import { DbKnowledgeQueryStore } from "@/db/repositories/db-knowledge-query-store";
import { LocalQuizAttemptStore } from "@/lib/quiz/local-attempt-store";
import type { QuizAttemptStore } from "@/lib/quiz/attempt-store";
import { LocalPublishedQuizStore } from "@/lib/quiz/local-published-store";
import type { PublishedQuizStore } from "@/lib/quiz/published-store";
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

import { resolveRuntimeMode } from "./mode";

type Environment = Record<string, string | undefined>;

type StoreCompositionInput = {
  environment: Environment;
  nodeEnvironment: "development" | "production" | "test" | undefined;
  projectRoot: string;
  databaseFactory: () => DatabaseClient;
};

export function createPublishedQuizStore(
  input: StoreCompositionInput,
): PublishedQuizStore {
  if (runtimeMode(input) === "local_demo") {
    return new LocalPublishedQuizStore(
      join(input.projectRoot, "artifacts", "quiz"),
    );
  }
  return new DbPublishedQuizStore(input.databaseFactory());
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

export function createKnowledgeQueryStore(
  input: StoreCompositionInput,
): KnowledgeQueryStore {
  if (runtimeMode(input) === "local_demo") {
    return new EmptyKnowledgeQueryStore();
  }
  return new DbKnowledgeQueryStore(input.databaseFactory());
}

export function getPublishedQuizStore(): PublishedQuizStore {
  return createPublishedQuizStore({
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
