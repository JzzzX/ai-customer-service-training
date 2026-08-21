import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  loadPublishedQuiz: vi.fn(),
  loadPublishedTopicQuiz: vi.fn(),
  loadQuizAttemptSnapshotForLearner: vi.fn(),
  saveQuizAttemptForLearner: vi.fn(),
  getQuizProgressForLearner: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/quiz/published-service", () => ({
  loadPublishedQuiz: mocks.loadPublishedQuiz,
  loadPublishedTopicQuiz: mocks.loadPublishedTopicQuiz,
}));

vi.mock("@/lib/quiz/attempt-service", () => ({
  loadQuizAttemptSnapshotForLearner: mocks.loadQuizAttemptSnapshotForLearner,
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
    });
    mocks.loadQuizAttemptSnapshotForLearner.mockResolvedValue({
      attemptId,
      learnerId,
      quizHash,
      passingScore: 80,
      status: "in_progress",
      questions: [
        {
          revisionId: "revision-1",
          id: `qq_${"1".repeat(24)}`,
          type: "single_choice",
          prompt: "第一题",
          options: ["答案一", "答案二"],
          correctAnswers: ["答案一"],
          explanation: "解释一",
          category: "日常问答",
          difficulty: "easy",
          status: "published",
          sources: [],
        },
        {
          revisionId: "revision-2",
          id: `qq_${"2".repeat(24)}`,
          type: "true_false",
          prompt: "第二题",
          options: ["正确", "错误"],
          correctAnswers: ["正确"],
          explanation: "解释二",
          category: "日常问答",
          difficulty: "easy",
          status: "published",
          sources: [],
        },
      ],
    });
    mocks.loadPublishedTopicQuiz.mockResolvedValue(null);
  });

  it("passes selections to the authoritative snapshot store under the session user", async () => {
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
          isCorrect: false,
        },
        {
          questionId: `qq_${"2".repeat(24)}`,
          selectedAnswers: ["错误"],
          isCorrect: false,
        },
      ],
    });
    expect(mocks.saveQuizAttemptForLearner.mock.calls[0]?.[0]).not.toHaveProperty(
      "assignmentId",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/practice/history");
  });

  it("rejects answers that do not belong to the active published quiz", async () => {
    mocks.saveQuizAttemptForLearner.mockRejectedValueOnce(
      new Error("题目不属于当前已发布题组。"),
    );
    await expect(
      saveQuizAttemptAction(quizHash, attemptId, [
        {
          questionId: `qq_${"f".repeat(24)}`,
          selected: "答案一",
        },
      ]),
    ).rejects.toThrow("题目不属于当前已发布题组");

    expect(mocks.saveQuizAttemptForLearner).toHaveBeenCalledOnce();
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
    mocks.loadQuizAttemptSnapshotForLearner.mockResolvedValue({
      attemptId: topicAttemptId,
      learnerId,
      quizHash: "f".repeat(64),
      passingScore: 80,
      status: "in_progress",
      topicId: question.category,
      questions: [{ ...question, revisionId: "topic-revision-1" }],
    });
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
      "f".repeat(64),
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
    expect(mocks.saveQuizAttemptForLearner).toHaveBeenCalledWith({
      attemptId: topicAttemptId,
      learnerId,
      quizHash: "f".repeat(64),
      topicId: question.category,
      passingScore: 80,
      answers: [
        {
          questionId: question.id,
          selectedAnswers: question.correctAnswers,
          isCorrect: false,
        },
      ],
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/practice");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/practice/quiz/topics",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/practice/profile");
  });

  it("rejects a topic attempt when the topic or question does not belong", async () => {
    const question = topicQuizQuestions[0]!;
    mocks.saveQuizAttemptForLearner.mockRejectedValue(
      new Error("题目不属于当前专题题库。"),
    );

    await expect(
      saveTopicQuizAttemptAction(
        "不存在的专题",
        "f".repeat(64),
        "00000000-0000-4000-8000-000000000061",
        [{ questionId: question.id, selected: question.correctAnswers[0]! }],
      ),
    ).rejects.toThrow();
    mocks.loadQuizAttemptSnapshotForLearner.mockResolvedValue({
      attemptId: "00000000-0000-4000-8000-000000000062",
      learnerId,
      quizHash: "f".repeat(64),
      passingScore: 80,
      status: "in_progress",
      topicId: "日常问答",
      questions: topicQuizQuestions.filter(
        (candidate) => candidate.category === "日常问答",
      ).map((candidate) => ({ ...candidate, revisionId: `revision-${candidate.id}` })),
    });
    await expect(
      saveTopicQuizAttemptAction(
        "日常问答",
        "f".repeat(64),
        "00000000-0000-4000-8000-000000000062",
        [{ questionId: question.id, selected: question.correctAnswers[0]! }],
      ),
    ).rejects.toThrow();
  });
});
