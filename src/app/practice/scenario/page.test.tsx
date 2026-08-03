import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { scenarioTemplates } from "@/lib/scenario/templates";

const progress = {
  publishedScenarioCount: 8,
  completedScenarioCount: 1,
  completedSessionCount: 2,
  recentAverageScore: 84,
  activeSessions: [],
  completedSessions: [],
};

vi.mock("@/lib/auth/guards", () => ({
  requireUser: vi.fn().mockResolvedValue({
    id: "00000000-0000-4000-8000-000000000002",
    name: "测试学员",
    email: "learner@example.test",
    role: "learner",
  }),
}));

vi.mock("@/lib/runtime/services", () => ({
  getScenarioAiMode: () => "real",
  getScenarioTemplateStore: () => ({
    listPublished: vi.fn().mockResolvedValue(scenarioTemplates),
  }),
  getScenarioTrainingService: () => ({
    getProgress: vi.fn().mockResolvedValue(progress),
  }),
}));

import ScenarioListPage from "./page";

describe("ScenarioListPage", () => {
  it("shows all eight scenarios with the active real AI mode", async () => {
    render(await ScenarioListPage());

    expect(
      screen.getByRole("heading", { name: "情景实战" }),
    ).toBeInTheDocument();
    expect(screen.getByText("AI 实战")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "售前" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "物流" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "破损少货" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "客诉" })).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "开始训练" }),
    ).toHaveLength(8);
    expect(screen.getByText("已完成 1 / 8 个场景")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "查看详细记录" }),
    ).toHaveAttribute("href", "/practice/profile?tab=scenario");
    expect(screen.getByText("给3个月泰迪推荐主粮")).toBeInTheDocument();
    expect(screen.getByText("食用后呕吐软便")).toBeInTheDocument();
  });
});
