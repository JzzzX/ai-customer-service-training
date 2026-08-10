// @vitest-environment node

import { describe, expect, it } from "vitest";

import { DbQuizAttemptStore } from "@/db/repositories/db-quiz-attempt-store";
import type { DatabaseClient } from "@/db/client";
import { LocalQuizAttemptStore } from "@/lib/quiz/local-attempt-store";

import { createQuizAttemptStore, createScenarioTrainingService } from "./services";
import { scenarioTemplates } from "@/lib/scenario/templates";

describe("runtime service composition", () => {
  it("composes a published quiz reader without review write methods", async () => {
    const runtime = (await import("./services")) as Record<string, unknown>;
    expect(runtime.createPublishedQuizStore).toBeTypeOf("function");

    const createPublishedQuizStore = runtime.createPublishedQuizStore as (
      input: {
        environment: Record<string, string | undefined>;
        nodeEnvironment: "development" | "production" | "test" | undefined;
        projectRoot: string;
        databaseFactory: () => DatabaseClient;
      },
    ) => Record<string, unknown>;
    const store = createPublishedQuizStore({
      environment: {
        LOCAL_TEST_AUTH_ENABLED: "true",
      },
      nodeEnvironment: "development",
      projectRoot: "/tmp/ai-training-test",
      databaseFactory: () => {
        throw new Error("local mode must not initialize the database");
      },
    });

    expect(store.loadPublished).toBeTypeOf("function");
    expect(store.loadReview).toBeUndefined();
    expect(store.approveQuestion).toBeUndefined();
    expect(store.publish).toBeUndefined();
  });

  it("selects local and database attempt adapters from the same runtime boundary", () => {
    const database = {} as DatabaseClient;
    const local = createQuizAttemptStore({
      environment: { LOCAL_TEST_AUTH_ENABLED: "true" },
      nodeEnvironment: "development",
      projectRoot: "/tmp/ai-training-test",
      databaseFactory: () => database,
    });
    const production = createQuizAttemptStore({
      environment: { LOCAL_TEST_AUTH_ENABLED: "true" },
      nodeEnvironment: "production",
      projectRoot: "/tmp/ai-training-test",
      databaseFactory: () => database,
    });

    expect(local).toBeInstanceOf(LocalQuizAttemptStore);
    expect(production).toBeInstanceOf(DbQuizAttemptStore);
  });

  it("records real mode when the runtime uses real AI with a legacy mock template", async () => {
    const service = createScenarioTrainingService({
      environment: {
        LOCAL_TEST_AUTH_ENABLED: "true",
        SCENARIO_AI_MODE: "real",
        OPENAI_API_KEY: "test-key",
        OPENAI_BASE_URL: "https://example.test/v1",
        OPENAI_MODEL: "test-model",
      },
      nodeEnvironment: "development",
      projectRoot: "/tmp/ai-training-real-mode-test",
      databaseFactory: () => {
        throw new Error("local mode must not initialize the database");
      },
    });

    const session = await service.start({
      learnerId: "00000000-0000-4000-8000-000000000002",
      scenarioId: scenarioTemplates[0].id,
    });

    expect(scenarioTemplates[0].mockMode).toBe(true);
    expect(session.mode).toBe("real");
  });
});
