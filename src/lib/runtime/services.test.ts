// @vitest-environment node

import { describe, expect, it } from "vitest";

import { DbQuizReviewStore } from "@/db/repositories/db-quiz-review-store";
import { DbQuizAttemptStore } from "@/db/repositories/db-quiz-attempt-store";
import { DbAssignmentStore } from "@/db/repositories/db-assignment-store";
import { DbReviewStore } from "@/db/repositories/db-review-store";
import type { DatabaseClient } from "@/db/client";
import { LocalQuizAttemptStore } from "@/lib/quiz/local-attempt-store";
import { LocalQuizReviewStore } from "@/lib/quiz/local-review-store";

import {
  createAssignmentService,
  createAssignmentStore,
  createQuizAttemptStore,
  createQuizReviewStore,
  createReviewService,
  createReviewStore,
  createScenarioTrainingService,
} from "./services";
import { scenarioTemplates } from "@/lib/scenario/templates";

describe("runtime service composition", () => {
  it("uses the local review adapter only for explicit local demo mode", () => {
    const store = createQuizReviewStore({
      environment: {
        LOCAL_TEST_AUTH_ENABLED: "true",
      },
      nodeEnvironment: "development",
      projectRoot: "/tmp/ai-training-test",
      databaseFactory: () => {
        throw new Error("local mode must not initialize the database");
      },
    });

    expect(store).toBeInstanceOf(LocalQuizReviewStore);
  });

  it("uses the database review adapter in production even if the local flag is present", () => {
    const database = {} as DatabaseClient;
    const store = createQuizReviewStore({
      environment: {
        LOCAL_TEST_AUTH_ENABLED: "true",
      },
      nodeEnvironment: "production",
      projectRoot: "/tmp/ai-training-test",
      databaseFactory: () => database,
    });

    expect(store).toBeInstanceOf(DbQuizReviewStore);
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

  it("composes production assignment and review services with database adapters", () => {
    const database = {} as DatabaseClient;
    const input = {
      environment: {},
      nodeEnvironment: "production" as const,
      projectRoot: "/tmp/ai-training-test",
      databaseFactory: () => database,
    };

    expect(createAssignmentStore(input)).toBeInstanceOf(
      DbAssignmentStore,
    );
    expect(createReviewStore(input)).toBeInstanceOf(DbReviewStore);
  });

  it("keeps local demo administration read-only", async () => {
    const input = {
      environment: { LOCAL_TEST_AUTH_ENABLED: "true" },
      nodeEnvironment: "development" as const,
      projectRoot: "/tmp/ai-training-test",
      databaseFactory: () => {
        throw new Error("local mode must not initialize the database");
      },
    };
    const assignments = createAssignmentService(input);
    const reviews = createReviewService(input);

    await expect(assignments.listForAdmin()).resolves.toEqual([]);
    await expect(reviews.listPending()).resolves.toEqual([]);
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
