import { describe, expect, it, vi } from "vitest";

import { MockEvaluationProvider } from "./mock-providers";
import type { ScenarioSession, ScenarioTemplate } from "./schema";
import type { ScenarioSessionStore } from "./session-store";
import { scenarioTemplates } from "./templates";
import type { ScenarioTemplateStore } from "./template-store";
import { ScenarioTrainingService } from "./training-service";

const learnerId = "00000000-0000-4000-8000-000000000002";
const sessionId = "00000000-0000-4000-8000-000000000010";

describe("ScenarioTrainingService.completeStream", () => {
  it("does not persist a completed report after the client aborts at the saving boundary", async () => {
    const scenario = scenarioTemplates[0];
    const session = createSession(scenario);
    const report = await new MockEvaluationProvider().evaluate({
      scenario,
      learnerMessages: ["我会先确认年龄和体重。"],
    });
    const completeSession = vi.fn().mockResolvedValue({
      ...session,
      status: "completed",
      report,
    });
    const store = {
      loadSession: vi.fn().mockResolvedValue(session),
      completeSession,
    } as unknown as ScenarioSessionStore;
    const templates = {
      getPublishedById: vi.fn().mockResolvedValue(scenario),
    } as unknown as ScenarioTemplateStore;
    const service = new ScenarioTrainingService({
      store,
      templates,
      conversationProvider: {
        async *streamCustomerReply() {},
      },
      evaluationProvider: {
        evaluate: vi.fn(),
        async *evaluateStream() {
          yield { report };
        },
      },
    });
    const abort = new AbortController();
    const iterator = service.completeStream({
      learnerId,
      sessionId,
      signal: abort.signal,
    })[Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toEqual({
      done: false,
      value: { phase: "analyzing" },
    });
    await expect(iterator.next()).resolves.toEqual({
      done: false,
      value: { phase: "scoring" },
    });
    await expect(iterator.next()).resolves.toEqual({
      done: false,
      value: { phase: "saving" },
    });

    abort.abort();

    await expect(iterator.next()).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(completeSession).not.toHaveBeenCalled();
  });
});

function createSession(scenario: ScenarioTemplate): ScenarioSession {
  return {
    id: sessionId,
    learnerId,
    scenarioId: scenario.id,
    scenarioVersionId: scenario.versionId,
    status: "active",
    mode: "real",
    learnerTurnCount: 1,
    maxTurns: scenario.maxTurns,
    messages: [
      {
        id: "00000000-0000-4000-8000-000000000020",
        role: "customer",
        content: scenario.openingMessage,
        createdAt: "2026-08-20T00:00:00.000Z",
      },
      {
        id: "00000000-0000-4000-8000-000000000021",
        role: "learner",
        content: "我会先确认年龄和体重。",
        createdAt: "2026-08-20T00:01:00.000Z",
      },
    ],
    startedAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:01:00.000Z",
  };
}
