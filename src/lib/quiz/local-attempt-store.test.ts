import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { LocalQuizAttemptStore } from "./local-attempt-store";

const learnerA = "00000000-0000-4000-8000-000000000002";
const learnerB = "00000000-0000-4000-8000-000000000003";

describe("LocalQuizAttemptStore", () => {
  let outputDir: string;

  beforeEach(async () => {
    outputDir = await mkdtemp(join(tmpdir(), "quiz-attempt-store-"));
  });

  it("stores completed attempts under the learner account", async () => {
    const store = new LocalQuizAttemptStore(outputDir);

    const saved = await store.saveAttempt({
      learnerId: learnerA,
      quizHash: "a".repeat(64),
      passingScore: 80,
      correctCount: 8,
      totalQuestions: 10,
      missedQuestionIds: [
        `qq_${"1".repeat(24)}`,
        `qq_${"2".repeat(24)}`,
      ],
      completedAt: "2026-07-29T08:00:00.000Z",
    });

    expect(saved).toMatchObject({
      learnerId: learnerA,
      score: 80,
      status: "passed",
      correctCount: 8,
      totalQuestions: 10,
    });
    await expect(store.listAttempts(learnerA)).resolves.toEqual([saved]);
    await expect(store.listAttempts(learnerB)).resolves.toEqual([]);
  });

  it("persists attempts atomically and returns newest first", async () => {
    const store = new LocalQuizAttemptStore(outputDir);
    await store.saveAttempt({
      learnerId: learnerA,
      quizHash: "a".repeat(64),
      passingScore: 80,
      correctCount: 4,
      totalQuestions: 5,
      missedQuestionIds: [`qq_${"1".repeat(24)}`],
      completedAt: "2026-07-29T08:00:00.000Z",
    });
    await store.saveAttempt({
      learnerId: learnerA,
      quizHash: "a".repeat(64),
      passingScore: 80,
      correctCount: 3,
      totalQuestions: 5,
      missedQuestionIds: [
        `qq_${"2".repeat(24)}`,
        `qq_${"3".repeat(24)}`,
      ],
      completedAt: "2026-07-29T09:00:00.000Z",
    });

    const attempts = await new LocalQuizAttemptStore(
      outputDir,
    ).listAttempts(learnerA);

    expect(attempts.map((attempt) => attempt.completedAt)).toEqual([
      "2026-07-29T09:00:00.000Z",
      "2026-07-29T08:00:00.000Z",
    ]);
    expect(attempts.map((attempt) => attempt.status)).toEqual([
      "needs_retry",
      "passed",
    ]);
    const stored = JSON.parse(
      await readFile(join(outputDir, `attempts-${learnerA}.json`), "utf8"),
    );
    expect(stored).toHaveLength(2);
  });
});
