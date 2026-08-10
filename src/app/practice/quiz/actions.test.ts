import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  loadPublishedQuiz: vi.fn(),
  saveQuizAttemptForLearner: vi.fn(),
  getQuizProgressForLearner: vi.fn(),
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
  getQuizProgressForLearner: mocks.getQuizProgressForLearner,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import {
  saveQuizAttemptAction,
  saveTopicQuizAttemptAction,
} from "./actions";
import { topicQuizQuestions } from "@/lib/quiz/question-bank";

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
    await saveQuizAttemptAction(quizHash, undefined, attemptId, [
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
      assignmentId: undefined,
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
      saveQuizAttemptAction(quizHash, undefined, attemptId, [
        {
          questionId: `qq_${"f".repeat(24)}`,
          selected: "答案一",
        },
      ]),
    ).rejects.toThrow("题目不属于当前已发布题组");

    expect(mocks.saveQuizAttemptForLearner).not.toHaveBeenCalled();
  });

  it("attaches a valid learner assignment to the saved attempt", async () => {
    const assignmentId =
      "00000000-0000-4000-8000-000000000090";

    await saveQuizAttemptAction(quizHash, assignmentId, attemptId, [
      {
        questionId: `qq_${"1".repeat(24)}`,
        selected: "答案一",
      },
    ]);

    expect(mocks.saveQuizAttemptForLearner).toHaveBeenCalledWith(
      expect.objectContaining({ assignmentId }),
    );
  });

  it("returns topic coverage delta after saving a topic attempt", async () => {
    const question = topicQuizQuestions[0]!;
    const topicAttemptId =
      "00000000-0000-4000-8000-000000000060";
    const savedAttempt = {
      id: topicAttemptId,
      learnerId,
      quizHash: "f".repeat(64),
      topicId: question.category,
      status: "passed" as const,
      correctCount: 1,
      totalQuestions: 1,
      score: 100,
      missedQuestionIds: [],
      answeredQuestionIds: [question.id],
      completedAt: "2026-08-03T08:00:00.000Z",
    };
    mocks.saveQuizAttemptForLearner.mockResolvedValue(savedAttempt);
    mocks.getQuizProgressForLearner.mockResolvedValue({
      totalQuestions: 350,
      uniqueAnsweredCount: 1,
      totalCorrectAnswers: 1,
      totalAnsweredAnswers: 1,
      accuracy: 100,
      attemptCount: 1,
      topics: [
        {
          topicId: question.category,
          totalQuestions: 25,
          uniqueAnsweredCount: 1,
          totalCorrectAnswers: 1,
          totalAnsweredAnswers: 1,
          accuracy: 100,
          attemptCount: 1,
        },
      ],
      recentAttempts: [
        { ...savedAttempt, newCoverageCount: 1 },
      ],
    });

    const result = await saveTopicQuizAttemptAction(
      question.category,
      topicAttemptId,
      [{ questionId: question.id, selected: question.correctAnswers[0]! }],
    );

    expect(result).toMatchObject({
      savedAttempt,
      newCoverageCount: 1,
      topicProgress: expect.objectContaining({
        uniqueAnsweredCount: 1,
        totalQuestions: 25,
      }),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/practice");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/practice/quiz/topics",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/practice/profile");
  });

  it("rejects a topic attempt when the topic or question does not belong", async () => {
    const question = topicQuizQuestions[0]!;

    await expect(
      saveTopicQuizAttemptAction(
        "不存在的专题",
        "00000000-0000-4000-8000-000000000061",
        [{ questionId: question.id, selected: question.correctAnswers[0]! }],
      ),
    ).rejects.toThrow();
    await expect(
      saveTopicQuizAttemptAction(
        "日常问答",
        "00000000-0000-4000-8000-000000000062",
        [{ questionId: question.id, selected: question.correctAnswers[0]! }],
      ),
    ).rejects.toThrow("题目不属于当前专题题库");
    expect(mocks.saveQuizAttemptForLearner).not.toHaveBeenCalled();
  });
});
