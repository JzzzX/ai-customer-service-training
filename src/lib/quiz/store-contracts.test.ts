import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { QuizAttemptStore } from "./attempt-store";
import { LocalQuizAttemptStore } from "./local-attempt-store";
import { LocalQuizReviewStore } from "./local-review-store";
import type { QuizReviewStore } from "./review-store";

describe("quiz persistence ports", () => {
  it("accepts the local review store through the review port", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "quiz-review-port-"));
    const store: QuizReviewStore = new LocalQuizReviewStore(outputDir);

    expect(store.loadReview).toBeTypeOf("function");
    expect(store.approveQuestion).toBeTypeOf("function");
    expect(store.publish).toBeTypeOf("function");
    expect(store.loadPublished).toBeTypeOf("function");
  });

  it("accepts the local attempt store through the attempt port", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "quiz-attempt-port-"));
    const store: QuizAttemptStore = new LocalQuizAttemptStore(outputDir);

    expect(store.saveAttempt).toBeTypeOf("function");
    await expect(
      store.listAttempts("00000000-0000-4000-8000-000000000002"),
    ).resolves.toEqual([]);
  });
});
