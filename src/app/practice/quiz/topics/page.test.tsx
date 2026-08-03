import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getQuizProgressForLearner: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireUser: vi.fn().mockResolvedValue({
    id: "learner-1",
    name: "测试学员",
    email: "learner@example.test",
    role: "learner",
  }),
}));

vi.mock("@/lib/quiz/attempt-service", () => ({
  getQuizProgressForLearner: mocks.getQuizProgressForLearner,
}));

import QuizTopicsPage from "./page";

describe("QuizTopicsPage", () => {
  it("renders 5 topic cards with links to /practice/quiz?topic=", async () => {
    mocks.getQuizProgressForLearner.mockResolvedValue({
      totalQuestions: 230,
      uniqueAnsweredCount: 3,
      totalCorrectAnswers: 3,
      totalAnsweredAnswers: 3,
      accuracy: 100,
      attemptCount: 1,
      topics: [
        {
          topicId: "产品属性及卖点",
          totalQuestions: 25,
          uniqueAnsweredCount: 3,
          totalCorrectAnswers: 3,
          totalAnsweredAnswers: 3,
          accuracy: 100,
          attemptCount: 1,
        },
      ],
      recentAttempts: [
        {
          id: "00000000-0000-4000-8000-000000000010",
          learnerId: "00000000-0000-4000-8000-000000000002",
          quizHash: "a".repeat(64),
          topicId: "产品属性及卖点",
          status: "passed",
          correctCount: 8,
          totalQuestions: 10,
          score: 80,
          missedQuestionIds: [],
          answeredQuestionIds: [],
          completedAt: "2026-08-02T08:00:00.000Z",
          newCoverageCount: 3,
        },
      ],
    });
    render(await QuizTopicsPage());

    expect(
      screen.getByRole("heading", { name: "选择专题" }),
    ).toBeInTheDocument();

    const topicLabels = [
      "产品属性及卖点",
      "宠物生理和喂养",
      "活动促销",
      "服务流程与规则",
      "日常问答",
    ];
    for (const label of topicLabels) {
      expect(
        screen.getByRole("heading", { name: label }),
      ).toBeInTheDocument();
    }

    const topicLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.includes("/practice/quiz?topic="));
    expect(topicLinks).toHaveLength(5);
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "P" && element.textContent === "3 / 230 题",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/已覆盖 3 \/ 65 题/)).toBeInTheDocument();
    expect(screen.getByText(/最近一次：产品属性及卖点/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "查看详细记录" }),
    ).toHaveAttribute("href", "/practice/profile?tab=quiz");
  });
});
