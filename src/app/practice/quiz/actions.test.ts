import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  loadPublishedQuiz: vi.fn(),
  saveQuizAttemptForLearner: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/quiz/review-service", () => ({
  loadPublishedQuiz: mocks.loadPublishedQuiz,
}));

vi.mock("@/lib/quiz/attempt-service", () => ({
  saveQuizAttemptForLearner: mocks.saveQuizAttemptForLearner,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { saveQuizAttemptAction } from "./actions";

const learnerId = "00000000-0000-4000-8000-000000000002";
const attemptId = "00000000-0000-4000-8000-000000000050";
const quizHash = "a".repeat(64);

describe("saveQuizAttemptAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({
      id: learnerId,
      name: "测试学员",
      email: "learner@example.test",
      role: "learner",
    });
    mocks.loadPublishedQuiz.mockResolvedValue({
      schemaVersion: 1,
      quizHash,
      sourceQuizHash: "b".repeat(64),
      knowledgePackHash: "c".repeat(64),
      title: "客服新人知识基础小测",
      passingScore: 80,
      status: "published",
      questions: [
        {
          id: `qq_${"1".repeat(24)}`,
          type: "single_choice",
          correctAnswers: ["答案一"],
        },
        {
          id: `qq_${"2".repeat(24)}`,
          type: "true_false",
          correctAnswers: ["正确"],
        },
      ],
    });
  });

  it("rechecks answers on the server and stores them under the session user", async () => {
    await saveQuizAttemptAction(quizHash, attemptId, [
      {
        questionId: `qq_${"1".repeat(24)}`,
        selected: "答案一",
      },
      {
        questionId: `qq_${"2".repeat(24)}`,
        selected: "错误",
      },
    ]);

    expect(mocks.saveQuizAttemptForLearner).toHaveBeenCalledWith({
      attemptId,
      learnerId,
      quizHash,
      passingScore: 80,
      answers: [
        {
          questionId: `qq_${"1".repeat(24)}`,
          selectedAnswers: ["答案一"],
          isCorrect: true,
        },
        {
          questionId: `qq_${"2".repeat(24)}`,
          selectedAnswers: ["错误"],
          isCorrect: false,
        },
      ],
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/practice/history");
  });

  it("rejects answers that do not belong to the active published quiz", async () => {
    await expect(
      saveQuizAttemptAction(quizHash, attemptId, [
        {
          questionId: `qq_${"f".repeat(24)}`,
          selected: "答案一",
        },
      ]),
    ).rejects.toThrow("题目不属于当前已发布题组");

    expect(mocks.saveQuizAttemptForLearner).not.toHaveBeenCalled();
  });
});
