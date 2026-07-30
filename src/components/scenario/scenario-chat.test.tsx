import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ScenarioSession } from "@/lib/scenario/schema";
import { scenarioTemplates } from "@/lib/scenario/templates";

const mocks = vi.hoisted(() => ({
  sendScenarioMessageAction: vi.fn(),
  completeScenarioAction: vi.fn(),
}));

vi.mock("@/app/practice/scenario/actions", () => ({
  sendScenarioMessageAction: mocks.sendScenarioMessageAction,
  completeScenarioAction: mocks.completeScenarioAction,
}));

import { ScenarioChat } from "./scenario-chat";

const sessionId = "00000000-0000-4000-8000-000000000010";
const initialSession: ScenarioSession = {
  id: sessionId,
  learnerId: "00000000-0000-4000-8000-000000000002",
  scenarioId: scenarioTemplates[0].id,
  scenarioVersionId: scenarioTemplates[0].versionId,
  status: "active",
  mode: "mock",
  learnerTurnCount: 0,
  maxTurns: 12,
  messages: [
    {
      id: "00000000-0000-4000-8000-000000000020",
      role: "customer",
      content: scenarioTemplates[0].openingMessage,
      createdAt: "2026-07-29T08:00:00.000Z",
    },
  ],
  startedAt: "2026-07-29T08:00:00.000Z",
  updatedAt: "2026-07-29T08:00:00.000Z",
};

describe("ScenarioChat", () => {
  it("continues the conversation and reveals the scripted customer reply", async () => {
    const learnerMessage = "想先了解狗狗的体重和现在怎么喂。";
    const customerReply = scenarioTemplates[0].customerTurns[0];
    const updated: ScenarioSession = {
      ...initialSession,
      learnerTurnCount: 1,
      messages: [
        ...initialSession.messages,
        {
          id: "00000000-0000-4000-8000-000000000021",
          role: "learner",
          content: learnerMessage,
          createdAt: "2026-07-29T08:01:00.000Z",
        },
        {
          id: "00000000-0000-4000-8000-000000000022",
          role: "customer",
          content: customerReply,
          createdAt: "2026-07-29T08:01:00.000Z",
        },
      ],
      updatedAt: "2026-07-29T08:01:00.000Z",
    };
    mocks.sendScenarioMessageAction.mockResolvedValue({
      result: {
        session: updated,
        customerChunks: ["体重大概2.1公斤，", "现在的粮会泡软再喂。"],
      },
    });

    render(
      <ScenarioChat
        initialSession={initialSession}
        scenarioTitle={scenarioTemplates[0].title}
      />,
    );
    fireEvent.change(screen.getByLabelText("回复顾客"), {
      target: { value: learnerMessage },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(await screen.findByText(learnerMessage)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(customerReply)).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("训练进度 8%")).toBeInTheDocument(),
    );
  });

  it("keeps the finish action visible without exposing scoring details", () => {
    render(
      <ScenarioChat
        initialSession={initialSession}
        scenarioTitle={scenarioTemplates[0].title}
      />,
    );

    expect(
      screen.getByRole("button", { name: "结束并查看报告" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("需求与宠物信息挖掘"),
    ).not.toBeInTheDocument();
  });
});
