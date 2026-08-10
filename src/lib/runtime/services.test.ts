// @vitest-environment node

import { describe, expect, it } from "vitest";

import { DbQuizAttemptStore } from "@/db/repositories/db-quiz-attempt-store";
import type { DatabaseClient } from "@/db/client";

import { createQuizAttemptStore } from "./services";

describe("runtime service composition", () => {
  it("composes a SQLite published quiz reader without review write methods", async () => {
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
      environment: {},
      nodeEnvironment: "development",
      projectRoot: "/tmp/ai-training-test",
      databaseFactory: () => {
        return {} as DatabaseClient;
      },
    });

    expect(store.loadPublished).toBeTypeOf("function");
    expect(store.loadReview).toBeUndefined();
    expect(store.approveQuestion).toBeUndefined();
    expect(store.publish).toBeUndefined();
  });

  it("always selects the database attempt adapter", () => {
    const database = {} as DatabaseClient;
    const store = createQuizAttemptStore({
      environment: {},
      nodeEnvironment: "test",
      projectRoot: "/tmp/ai-training-test",
      databaseFactory: () => database,
    });

    expect(store).toBeInstanceOf(DbQuizAttemptStore);
  });
});
