import { describe, expect, it } from "vitest";

import {
  summarizeQuizProgress,
  type QuizProgressCatalogTopic,
} from "./progress";
import type { QuizAttemptRecord } from "./attempt-store";

const catalog: QuizProgressCatalogTopic[] = [
  { id: "topic-a", totalQuestions: 3 },
  { id: "topic-b", totalQuestions: 2 },
];

describe("summarizeQuizProgress", () => {
  it("deduplicates topic coverage and reports new coverage per attempt", () => {
    const summary = summarizeQuizProgress(
      [
        attempt({
          id: "00000000-0000-4000-8000-000000000001",
          topicId: "topic-a",
          answeredQuestionIds: [question(1), question(2)],
          correctCount: 2,
          totalQuestions: 2,
          completedAt: "2026-08-01T08:00:00.000Z",
        }),
        attempt({
          id: "00000000-0000-4000-8000-000000000002",
          topicId: "topic-a",
          answeredQuestionIds: [question(2), question(3)],
          correctCount: 0,
          totalQuestions: 2,
          completedAt: "2026-08-02T08:00:00.000Z",
        }),
        attempt({
          id: "00000000-0000-4000-8000-000000000003",
          topicId: "topic-b",
          answeredQuestionIds: [question(4)],
          correctCount: 1,
          totalQuestions: 1,
          completedAt: "2026-08-03T08:00:00.000Z",
        }),
        attempt({
          id: "00000000-0000-4000-8000-000000000004",
          answeredQuestionIds: [question(9)],
          correctCount: 1,
          totalQuestions: 1,
          completedAt: "2026-08-04T08:00:00.000Z",
        }),
      ],
      catalog,
    );

    expect(summary).toMatchObject({
      totalQuestions: 5,
      uniqueAnsweredCount: 4,
      totalCorrectAnswers: 4,
      totalAnsweredAnswers: 6,
      accuracy: 67,
      attemptCount: 4,
    });
    expect(summary.topics).toEqual([
      expect.objectContaining({
        topicId: "topic-a",
        uniqueAnsweredCount: 3,
        totalCorrectAnswers: 2,
        totalAnsweredAnswers: 4,
        accuracy: 50,
        attemptCount: 2,
      }),
      expect.objectContaining({
        topicId: "topic-b",
        uniqueAnsweredCount: 1,
        totalCorrectAnswers: 1,
        totalAnsweredAnswers: 1,
        accuracy: 100,
        attemptCount: 1,
      }),
    ]);
    expect(summary.recentAttempts.map((item) => item.newCoverageCount)).toEqual([
      0,
      1,
      1,
      2,
    ]);
  });

  it("uses known missed IDs for legacy local records without inventing correct IDs", () => {
    const legacy = attempt({
      topicId: "topic-a",
      missedQuestionIds: [question(2)],
      answeredQuestionIds: undefined,
      correctCount: 1,
      totalQuestions: 2,
    });

    const summary = summarizeQuizProgress([legacy], catalog);

    expect(summary.topics[0]).toMatchObject({
      uniqueAnsweredCount: 1,
      totalAnsweredAnswers: 2,
      totalCorrectAnswers: 1,
    });
    expect(summary.recentAttempts[0]?.newCoverageCount).toBe(1);
  });
});

function attempt(
  overrides: Partial<QuizAttemptRecord> = {},
): QuizAttemptRecord {
  return {
    id: "00000000-0000-4000-8000-000000000099",
    learnerId: "00000000-0000-4000-8000-000000000002",
    quizHash: "a".repeat(64),
    status: "passed",
    correctCount: 1,
    totalQuestions: 1,
    score: 100,
    missedQuestionIds: [],
    completedAt: "2026-08-01T08:00:00.000Z",
    ...overrides,
  };
}

function question(index: number): string {
  return `qq_${index.toString(16).padStart(24, "0")}`;
}
