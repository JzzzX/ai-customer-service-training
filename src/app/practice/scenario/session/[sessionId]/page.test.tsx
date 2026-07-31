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

vi.mock("next/navigation", async (importActual) => {
  const actual =
    await importActual<typeof import("next/navigation")>();
  return {
    ...actual,
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    }),
  };
});

import ScenarioSessionPage from "./page";

describe("ScenarioSessionPage", () => {
  it("restores an active conversation without exposing hidden facts", async () => {
    const scenario = scenarioTemplates[0];
    const session: ScenarioSession = {
      id: "00000000-0000-4000-8000-000000000010",
      learnerId: "00000000-0000-4000-8000-000000000002",
      scenarioId: scenario.id,
      scenarioVersionId: scenario.versionId,
      status: "active",
      mode: "mock",
      learnerTurnCount: 0,
      maxTurns: 12,
      messages: [
        {
          id: "00000000-0000-4000-8000-000000000020",
          role: "customer",
          content: scenario.openingMessage,
          createdAt: "2026-07-29T08:00:00.000Z",
        },
      ],
      startedAt: "2026-07-29T08:00:00.000Z",
      updatedAt: "2026-07-29T08:00:00.000Z",
    };
    mocks.load.mockResolvedValue(session);
    mocks.getPublishedById.mockResolvedValue(scenario);

    render(
      await ScenarioSessionPage({
        params: Promise.resolve({ sessionId: session.id }),
      }),
    );

    expect(
      screen.getByRole("heading", { name: "模拟接待" }),
    ).toBeInTheDocument();
    expect(screen.getByText("演示模式")).toBeInTheDocument();
    expect(screen.getByText(scenario.title)).toBeInTheDocument();
    expect(screen.getByText(scenario.openingMessage)).toBeInTheDocument();
    expect(screen.queryByText("体重2.1kg")).not.toBeInTheDocument();
  });
});
