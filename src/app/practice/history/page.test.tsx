import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  listQuizAttemptsForLearner: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/quiz/attempt-service", () => ({
  listQuizAttemptsForLearner: mocks.listQuizAttemptsForLearner,
}));

import PracticeHistoryPage from "./page";

describe("PracticeHistoryPage", () => {
  it("shows the signed-in learner's quiz attempts and topic progress", async () => {
    const learnerId = "00000000-0000-4000-8000-000000000002";
    mocks.requireUser.mockResolvedValue({
      id: learnerId,
      name: "测试学员",
      email: "learner@example.test",
      role: "learner",
    });
    mocks.listQuizAttemptsForLearner.mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000010",
        learnerId,
        quizHash: "a".repeat(64),
        status: "passed",
        correctCount: 8,
        totalQuestions: 10,
        score: 80,
        missedQuestionIds: [
          `qq_${"1".repeat(24)}`,
          `qq_${"2".repeat(24)}`,
        ],
        completedAt: "2026-07-29T08:00:00.000Z",
      },
    ]);

    render(await PracticeHistoryPage());

    expect(
      screen.getByRole("heading", { name: "学习进度" }),
    ).toBeInTheDocument();
    expect(mocks.listQuizAttemptsForLearner).toHaveBeenCalledWith(learnerId);
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("正式题组")).toBeInTheDocument();
    expect(screen.getAllByText(/还未开始/)).toHaveLength(5);
  });

  it("shows topic progress when attempts have topicId", async () => {
    const learnerId = "00000000-0000-4000-8000-000000000002";
    mocks.requireUser.mockResolvedValue({
      id: learnerId,
      name: "测试学员",
      email: "learner@example.test",
      role: "learner",
    });
    mocks.listQuizAttemptsForLearner.mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000020",
        learnerId,
        quizHash: "f".repeat(64),
        topicId: "产品属性及卖点",
        status: "passed",
        correctCount: 9,
        totalQuestions: 10,
        score: 90,
        missedQuestionIds: [],
        completedAt: "2026-07-30T08:00:00.000Z",
      },
    ]);

    render(await PracticeHistoryPage());

    expect(screen.getByText(/已练 10 \/ 25 题/)).toBeInTheDocument();
    expect(screen.getByText(/平均正确率 90%/)).toBeInTheDocument();
    expect(screen.getByText("90%")).toBeInTheDocument();
  });
});
