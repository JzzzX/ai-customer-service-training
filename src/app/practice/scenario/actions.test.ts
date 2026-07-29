import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  redirect: vi.fn(),
  start: vi.fn(),
  sendMessage: vi.fn(),
  complete: vi.fn(),
  restart: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/scenario/scenario-service", () => ({
  getLocalScenarioTrainingService: () => ({
    start: mocks.start,
    sendMessage: mocks.sendMessage,
    complete: mocks.complete,
    restart: mocks.restart,
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

import {
  completeScenarioAction,
  restartScenarioAction,
  sendScenarioMessageAction,
  startScenarioAction,
} from "./actions";

const learnerId = "00000000-0000-4000-8000-000000000002";
const sessionId = "00000000-0000-4000-8000-000000000010";
const restartedId = "00000000-0000-4000-8000-000000000011";
const scenarioId = `st_${"1".repeat(24)}`;

describe("scenario server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({
      id: learnerId,
      name: "测试学员",
      email: "learner@example.test",
      role: "learner",
    });
  });

  it("starts the selected scenario for the signed-in learner", async () => {
    mocks.start.mockResolvedValue({ id: sessionId });
    const formData = new FormData();
    formData.set("scenarioId", scenarioId);

    await startScenarioAction(formData);

    expect(mocks.start).toHaveBeenCalledWith({ learnerId, scenarioId });
    expect(mocks.redirect).toHaveBeenCalledWith(
      `/practice/scenario/session/${sessionId}`,
    );
  });

  it("returns a visible validation error for a blank learner message", async () => {
    const formData = new FormData();
    formData.set("sessionId", sessionId);
    formData.set("content", "   ");

    const state = await sendScenarioMessageAction({}, formData);

    expect(state).toEqual({ error: "请输入回复内容。" });
    expect(mocks.sendMessage).not.toHaveBeenCalled();
  });

  it("returns the updated session and customer chunks after a message", async () => {
    const result = {
      session: { id: sessionId, learnerTurnCount: 1 },
      customerChunks: ["刚满3个月，", "大概2.1公斤。"],
    };
    mocks.sendMessage.mockResolvedValue(result);
    const formData = new FormData();
    formData.set("sessionId", sessionId);
    formData.set("content", "请问宠物多大、体重多少？");

    const state = await sendScenarioMessageAction({}, formData);

    expect(state).toEqual({ result });
    expect(mocks.sendMessage).toHaveBeenCalledWith({
      learnerId,
      sessionId,
      content: "请问宠物多大、体重多少？",
    });
  });

  it("completes to a report and restarts into a new session", async () => {
    mocks.complete.mockResolvedValue({ id: sessionId });
    mocks.restart.mockResolvedValue({ id: restartedId });
    const completeData = new FormData();
    completeData.set("sessionId", sessionId);
    const restartData = new FormData();
    restartData.set("sessionId", sessionId);

    await completeScenarioAction(completeData);
    await restartScenarioAction(restartData);

    expect(mocks.redirect).toHaveBeenCalledWith(
      `/practice/scenario/report/${sessionId}`,
    );
    expect(mocks.redirect).toHaveBeenCalledWith(
      `/practice/scenario/session/${restartedId}`,
    );
  });
});
