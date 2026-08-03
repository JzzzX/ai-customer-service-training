import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getQuizProgressForLearner: vi.fn(),
  getScenarioProgress: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireUser: vi.fn().mockResolvedValue({
    id: "00000000-0000-4000-8000-000000000002",
    name: "测试学员",
    email: "learner@example.test",
    role: "learner",
  }),
}));

vi.mock("@/components/sign-out-button", () => ({
  SignOutButton: () => <button type="button">退出登录</button>,
}));

vi.mock("@/lib/quiz/attempt-service", () => ({
  getQuizProgressForLearner: mocks.getQuizProgressForLearner,
}));

vi.mock("@/lib/runtime/services", () => ({
  getScenarioTemplateStore: () => ({
    listPublished: vi.fn().mockResolvedValue([
      { id: "st_aaaaaaaaaaaaaaaaaaaaaaaa" },
      { id: "st_bbbbbbbbbbbbbbbbbbbbbbbb" },
    ]),
  }),
  getScenarioTrainingService: () => ({
    getProgress: mocks.getScenarioProgress,
  }),
}));

import PracticePage from "./page";

describe("PracticePage", () => {
  it("shows only the two primary training entrances and the profile link", async () => {
    mocks.getQuizProgressForLearner.mockResolvedValue({
      totalQuestions: 10,
      uniqueAnsweredCount: 1,
      accuracy: 100,
      totalCorrectAnswers: 1,
      totalAnsweredAnswers: 1,
      attemptCount: 1,
      topics: [],
      recentAttempts: [],
    });
    mocks.getScenarioProgress.mockResolvedValue({
      publishedScenarioCount: 2,
      completedScenarioCount: 1,
      completedSessionCount: 1,
      recentAverageScore: 88,
      activeSessions: [],
      completedSessions: [],
    });

    render(await PracticePage());

    expect(
      screen.getByRole("link", { name: "选择专题" }),
    ).toHaveAttribute("href", "/practice/quiz/topics");
    expect(
      screen.getByRole("link", { name: "开始实战" }),
    ).toHaveAttribute("href", "/practice/scenario");
    expect(screen.queryByRole("link", { name: "查看任务" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "查看练习记录" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "进入个人中心" })).toHaveAttribute(
      "href",
      "/practice/profile",
    );
    expect(screen.getByText(/已覆盖 1 \/ 10 题/)).toBeInTheDocument();
    expect(screen.getByText(/已完成 1 \/ 2 个场景/)).toBeInTheDocument();
  });
});
