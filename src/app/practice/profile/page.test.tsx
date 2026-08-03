import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getQuizProgressForLearner: vi.fn(),
  getScenarioProgress: vi.fn(),
  listAssignments: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/components/sign-out-button", () => ({
  SignOutButton: () => <button type="button">退出登录</button>,
}));

vi.mock("@/lib/quiz/attempt-service", () => ({
  getQuizProgressForLearner: mocks.getQuizProgressForLearner,
}));

vi.mock("@/lib/runtime/services", () => ({
  getAssignmentService: () => ({
    listForLearner: mocks.listAssignments,
  }),
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

import ProfilePage from "./page";

const learnerId = "00000000-0000-4000-8000-000000000002";

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({
      id: learnerId,
      name: "测试学员",
      email: "learner@example.test",
      role: "learner",
    });
    mocks.getQuizProgressForLearner.mockResolvedValue(quizProgress());
    mocks.getScenarioProgress.mockResolvedValue(scenarioProgress());
    mocks.listAssignments.mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000010",
        learnerId,
        learnerName: "测试学员",
        assignedById: "00000000-0000-4000-8000-000000000001",
        assignmentType: "quiz",
        targetId: "00000000-0000-4000-8000-000000000011",
        targetLabel: "物流专题测验",
        launchHref: "/practice/quiz?assignment=00000000-0000-4000-8000-000000000011",
        status: "assigned",
        createdAt: "2026-08-01T08:00:00.000Z",
      },
    ]);
  });

  it("defaults to tasks and exposes all three profile tabs", async () => {
    render(await ProfilePage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByRole("heading", { name: "个人中心" }),
    ).toBeInTheDocument();
    expect(screen.getByText("物流专题测验")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "知识记录" })).toHaveAttribute(
      "href",
      "/practice/profile?tab=quiz",
    );
    expect(screen.getByRole("link", { name: "实战记录" })).toHaveAttribute(
      "href",
      "/practice/profile?tab=scenario",
    );
    expect(screen.getByText("知识覆盖")).toBeInTheDocument();
    expect(screen.getByText("测试学员")).toBeInTheDocument();
    expect(screen.getByText("learner@example.test")).toBeInTheDocument();
    expect(screen.getByText("1 / 10 题")).toBeInTheDocument();
    expect(screen.getByText("实战覆盖")).toBeInTheDocument();
    expect(screen.getByText("1 / 2 个场景")).toBeInTheDocument();
  });

  it("renders detailed quiz recap for the quiz tab", async () => {
    render(
      await ProfilePage({
        searchParams: Promise.resolve({ tab: "quiz" }),
      }),
    );

    expect(screen.getByText("专题进度")).toBeInTheDocument();
    expect(screen.getAllByText("产品属性及卖点")).not.toHaveLength(0);
    expect(screen.getByText("最近练习")).toBeInTheDocument();
    expect(screen.getByText(/新覆盖 1 题/)).toBeInTheDocument();
    expect(mocks.listAssignments).not.toHaveBeenCalled();
  });

  it("renders active sessions and completed report links for the scenario tab", async () => {
    render(
      await ProfilePage({
        searchParams: Promise.resolve({ tab: "scenario" }),
      }),
    );

    expect(screen.getByText("继续训练")).toBeInTheDocument();
    expect(screen.getByText("给3个月泰迪推荐主粮")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "查看完整报告" }),
    ).toHaveAttribute(
      "href",
      "/practice/scenario/report/00000000-0000-4000-8000-000000000021",
    );
    expect(mocks.listAssignments).not.toHaveBeenCalled();
  });

  it("falls back to tasks for an unknown tab", async () => {
    render(
      await ProfilePage({
        searchParams: Promise.resolve({ tab: "unknown" }),
      }),
    );

    expect(screen.getByText("物流专题测验")).toBeInTheDocument();
  });

  it("does not expose a learner profile entry to administrator accounts", async () => {
    mocks.requireUser.mockResolvedValue({
      id: learnerId,
      name: "管理员",
      email: "admin@example.test",
      role: "admin",
    });

    render(await ProfilePage({ searchParams: Promise.resolve({}) }));

    expect(screen.queryByRole("link", { name: "管理端" })).not.toBeInTheDocument();
  });
});

function quizProgress() {
  return {
    totalQuestions: 10,
    uniqueAnsweredCount: 1,
    totalCorrectAnswers: 1,
    totalAnsweredAnswers: 1,
    accuracy: 100,
    attemptCount: 1,
    topics: [
      {
        topicId: "产品属性及卖点",
        totalQuestions: 10,
        uniqueAnsweredCount: 1,
        totalCorrectAnswers: 1,
        totalAnsweredAnswers: 1,
        accuracy: 100,
        attemptCount: 1,
      },
    ],
    recentAttempts: [
      {
        id: "00000000-0000-4000-8000-000000000020",
        learnerId,
        quizHash: "a".repeat(64),
        topicId: "产品属性及卖点",
        status: "passed",
        correctCount: 1,
        totalQuestions: 1,
        score: 100,
        missedQuestionIds: [],
        answeredQuestionIds: ["qq_a00000000000000000000001"],
        completedAt: "2026-08-02T08:00:00.000Z",
        newCoverageCount: 1,
      },
    ],
  };
}

function scenarioProgress() {
  return {
    publishedScenarioCount: 2,
    completedScenarioCount: 1,
    completedSessionCount: 2,
    recentAverageScore: 84,
    activeSessions: [
      {
        id: "00000000-0000-4000-8000-000000000022",
        learnerId,
        scenarioId: "st_aaaaaaaaaaaaaaaaaaaaaaaa",
        scenarioVersionId: "sv_aaaaaaaaaaaaaaaaaaaaaaaa",
        title: "处理中场景",
        category: "presale",
        status: "active",
        mode: "mock",
        learnerTurnCount: 2,
        maxTurns: 8,
        startedAt: "2026-08-02T08:00:00.000Z",
        updatedAt: "2026-08-02T08:02:00.000Z",
      },
    ],
    completedSessions: [
      {
        id: "00000000-0000-4000-8000-000000000021",
        learnerId,
        scenarioId: "st_bbbbbbbbbbbbbbbbbbbbbbbb",
        scenarioVersionId: "sv_bbbbbbbbbbbbbbbbbbbbbbbb",
        title: "给3个月泰迪推荐主粮",
        category: "presale",
        status: "completed",
        mode: "mock",
        learnerTurnCount: 8,
        maxTurns: 8,
        startedAt: "2026-08-01T08:00:00.000Z",
        updatedAt: "2026-08-01T08:10:00.000Z",
        completedAt: "2026-08-01T08:10:00.000Z",
        score: 88,
        verdict: "passed",
      },
    ],
  };
}
