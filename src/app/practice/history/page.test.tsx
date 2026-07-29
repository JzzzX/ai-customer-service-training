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
  it("shows only the signed-in learner's quiz attempts", async () => {
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
      screen.getByRole("heading", { name: "练习记录" }),
    ).toBeInTheDocument();
    expect(mocks.listQuizAttemptsForLearner).toHaveBeenCalledWith(learnerId);
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("已通过")).toBeInTheDocument();
    expect(screen.getByText("答对 8 / 10 题")).toBeInTheDocument();
    expect(screen.getByText("2 道错题")).toBeInTheDocument();
  });
});
