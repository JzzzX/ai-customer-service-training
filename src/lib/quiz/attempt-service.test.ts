import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getQuizAttemptStore: vi.fn(),
}));

vi.mock("@/lib/runtime/services", () => mocks);

import { getQuizProgressForLearner } from "./attempt-service";

describe("getQuizProgressForLearner", () => {
  it("builds the progress summary from the learner's attempts", async () => {
    mocks.getQuizAttemptStore.mockReturnValue({
      listAttempts: vi.fn().mockResolvedValue([
        {
          id: "00000000-0000-4000-8000-000000000001",
          learnerId: "00000000-0000-4000-8000-000000000002",
          quizHash: "a".repeat(64),
          topicId: "产品属性及卖点",
          status: "passed",
          correctCount: 1,
          totalQuestions: 1,
          score: 100,
          missedQuestionIds: [],
          answeredQuestionIds: ["qq_a00000000000000000000001"],
          completedAt: "2026-08-01T08:00:00.000Z",
        },
      ]),
    });

    const summary = await getQuizProgressForLearner(
      "00000000-0000-4000-8000-000000000002",
    );

    expect(summary.totalQuestions).toBeGreaterThan(0);
    expect(summary.uniqueAnsweredCount).toBe(1);
    expect(summary.topics).toHaveLength(5);
  });
});
