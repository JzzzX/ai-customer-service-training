import { describe, expect, it } from "vitest";

import { DbQuizReviewStore } from "@/db/repositories/db-quiz-review-store";
import type { DatabaseClient } from "@/db/client";
import { LocalQuizReviewStore } from "@/lib/quiz/local-review-store";

import { createQuizReviewStore } from "./services";

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
});
