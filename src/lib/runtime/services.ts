import { getDatabase, type DatabaseClient } from "@/db/client";
import { DbQuizAttemptStore } from "@/db/repositories/db-quiz-attempt-store";
import { DbPublishedQuizStore } from "@/db/repositories/db-published-quiz-store";
import { DbScenarioSessionStore } from "@/db/repositories/db-scenario-session-store";
import { DbScenarioTemplateStore } from "@/db/repositories/db-scenario-template-store";
import { DbKnowledgeQueryStore } from "@/db/repositories/db-knowledge-query-store";
import type { QuizAttemptStore } from "@/lib/quiz/attempt-store";
import type { PublishedQuizStore } from "@/lib/quiz/published-store";
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
import type { KnowledgeQueryStore } from "@/lib/knowledge/query-store";

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
  return new DbPublishedQuizStore(input.databaseFactory());
}

export function createQuizAttemptStore(
  input: StoreCompositionInput,
): QuizAttemptStore {
  return new DbQuizAttemptStore(input.databaseFactory());
}

export function createKnowledgeQueryStore(
  input: StoreCompositionInput,
): KnowledgeQueryStore {
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
  const database = input.databaseFactory();
  const templates = createScenarioTemplateStore({
    ...input,
    databaseFactory: () => database,
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
    store: new DbScenarioSessionStore(database),
    templates,
    conversationProvider: providers.conversation,
    evaluationProvider: providers.evaluation,
    liveRiskProvider: providers.liveRisk,
    mode: aiMode,
    knowledgeUnitLoader: async (scenario) => {
      const queryStore = new DbKnowledgeQueryStore(database);
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
