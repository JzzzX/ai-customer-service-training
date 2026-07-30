import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ScenarioSession } from "@/lib/scenario/schema";
import { scenarioTemplates } from "@/lib/scenario/templates";

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  getPublishedById: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireUser: vi.fn().mockResolvedValue({
    id: "00000000-0000-4000-8000-000000000002",
    name: "测试学员",
    email: "learner@example.test",
    role: "learner",
  }),
}));

vi.mock("@/lib/runtime/services", () => ({
  getScenarioTrainingService: () => ({
    load: mocks.load,
  }),
  getScenarioTemplateStore: () => ({
    getPublishedById: mocks.getPublishedById,
  }),
}));

vi.mock("../../actions", () => ({
  restartScenarioAction: vi.fn(),
}));

import ScenarioReportPage from "./page";

describe("ScenarioReportPage", () => {
  it("shows a clearly labeled mock report with five dimensions and retry", async () => {
    const scenario = scenarioTemplates[0];
    const session: ScenarioSession = {
      id: "00000000-0000-4000-8000-000000000010",
      learnerId: "00000000-0000-4000-8000-000000000002",
      scenarioId: scenario.id,
      scenarioVersionId: scenario.versionId,
      status: "completed",
      mode: "mock",
      learnerTurnCount: 1,
      maxTurns: 12,
      messages: [
        {
          id: "00000000-0000-4000-8000-000000000020",
          role: "customer",
          content: scenario.openingMessage,
          createdAt: "2026-07-29T08:00:00.000Z",
        },
        {
          id: "00000000-0000-4000-8000-000000000021",
          role: "learner",
          content: "完整示例回复",
          createdAt: "2026-07-29T08:01:00.000Z",
        },
      ],
      report: {
        mode: "mock",
        totalScore: 100,
        status: "passed",
        confidence: 0.92,
        dimensions: scenario.scoringDimensions.map((dimension) => ({
          name: dimension.name,
          score: dimension.weight,
          maxScore: dimension.weight,
          evidence: dimension.signals.slice(0, 2),
        })),
        strengths: scenario.scoringDimensions.map(
          (dimension) => dimension.name,
        ),
        missedSteps: [],
        risks: [],
        recommendations: scenario.referenceFlow.map((step) => ({
          issue: "参考流程",
          suggestedReply: step,
        })),
        referenceReply: scenario.referenceReply,
        lowConfidence: false,
      },
      startedAt: "2026-07-29T08:00:00.000Z",
      updatedAt: "2026-07-29T08:02:00.000Z",
      completedAt: "2026-07-29T08:02:00.000Z",
    };
    mocks.load.mockResolvedValue(session);
    mocks.getPublishedById.mockResolvedValue(scenario);

    render(
      await ScenarioReportPage({
        params: Promise.resolve({ sessionId: session.id }),
      }),
    );

    expect(
      screen.getByRole("heading", { name: "本次训练通过" }),
    ).toBeInTheDocument();
    expect(screen.getByText("演示评分")).toBeInTheDocument();
    expect(screen.getByText("100分")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "五维表现" }),
    ).toBeInTheDocument();
    expect(screen.getByText("需求与宠物信息挖掘")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "改进建议" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "参考回复" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "重新练习这个场景" }),
    ).toBeInTheDocument();
  });
});
