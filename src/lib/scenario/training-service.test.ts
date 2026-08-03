import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { LocalScenarioSessionStore } from "./local-session-store";
import {
  MockConversationProvider,
  MockEvaluationProvider,
  MockLiveRiskProvider,
} from "./mock-providers";
import { ScenarioTrainingService } from "./training-service";
import { getScenarioTemplate, scenarioTemplates } from "./templates";

const learnerId = "00000000-0000-4000-8000-000000000002";

describe("ScenarioTrainingService", () => {
  let service: ScenarioTrainingService;

  beforeEach(async () => {
    const outputDir = await mkdtemp(
      join(tmpdir(), "scenario-training-service-"),
    );
    service = new ScenarioTrainingService({
      store: new LocalScenarioSessionStore(outputDir),
      templates: {
        async listPublished() {
          return scenarioTemplates;
        },
        async getPublishedById(scenarioId) {
          return getScenarioTemplate(scenarioId) ?? null;
        },
      },
      conversationProvider: new MockConversationProvider(),
      evaluationProvider: new MockEvaluationProvider(),
    });
  });

  it("starts a scenario and persists the streamed scripted reply", async () => {
    const scenario = scenarioTemplates[0];
    const session = await service.start({
      learnerId,
      scenarioId: scenario.id,
    });

    const result = await service.sendMessage({
      learnerId,
      sessionId: session.id,
      content: "想先了解宠物年龄、体重和当前饮食。",
    });

    expect(result.customerChunks.length).toBeGreaterThan(1);
    expect(result.customerChunks.join("")).toBe(scenario.customerTurns[0]);
    expect(result.session.learnerTurnCount).toBe(1);
    await expect(
      service.load({ learnerId, sessionId: session.id }),
    ).resolves.toEqual(result.session);
  });

  it("evaluates, completes and restarts the same scenario", async () => {
    const scenario = scenarioTemplates[0];
    const session = await service.start({
      learnerId,
      scenarioId: scenario.id,
    });
    await service.sendMessage({
      learnerId,
      sessionId: session.id,
      content:
        "我理解价格顾虑，先确认年龄和预算，因为要选适合的主粮；换粮逐步过渡。我会推荐并后续跟进。",
    });

    const completed = await service.complete({
      learnerId,
      sessionId: session.id,
    });
    const restarted = await service.restart({
      learnerId,
      sessionId: session.id,
    });

    expect(completed.status).toBe("completed");
    expect(completed.report?.totalScore).toBe(100);
    expect(completed.report?.status).toBe("passed");
    expect(restarted.id).not.toBe(session.id);
    expect(restarted.scenarioId).toBe(session.scenarioId);
    expect(restarted.status).toBe("active");
    expect(restarted.learnerTurnCount).toBe(0);
  });

  it("rejects an unknown or stale scenario version", async () => {
    await expect(
      service.start({
        learnerId,
        scenarioId: `st_${"f".repeat(24)}`,
      }),
    ).rejects.toThrow("场景不存在或未发布");
  });

  it("keeps the final conversation turn active until report generation starts", async () => {
    const scenario = scenarioTemplates[0];
    let session = await service.start({
      learnerId,
      scenarioId: scenario.id,
    });

    for (let turn = 0; turn < scenario.maxTurns; turn += 1) {
      const result = await service.sendMessage({
        learnerId,
        sessionId: session.id,
        content: `第${turn + 1}轮：年龄、预算、适合、因为、主粮、换粮、理解、价格、推荐、后续。`,
      });
      session = result.session;
    }

    expect(session.learnerTurnCount).toBe(scenario.maxTurns);
    expect(session.status).toBe("active");
    expect(session.report).toBeUndefined();
    expect(session.messages.at(-1)?.role).toBe("customer");
  });

  it("persists the report before yielding the completion event", async () => {
    const scenario = scenarioTemplates[0];
    const outputDir = await mkdtemp(
      join(tmpdir(), "scenario-training-stream-"),
    );
    const baseEvaluation = new MockEvaluationProvider();
    const serviceWithStream = new ScenarioTrainingService({
      store: new LocalScenarioSessionStore(outputDir),
      templates: {
        async listPublished() {
          return scenarioTemplates;
        },
        async getPublishedById(scenarioId) {
          return getScenarioTemplate(scenarioId) ?? null;
        },
      },
      conversationProvider: new MockConversationProvider(),
      evaluationProvider: {
        evaluate: (input) => baseEvaluation.evaluate(input),
        async *evaluateStream(input) {
          yield { delta: "{\"confidence\":" };
          yield* baseEvaluation.evaluateStream(input);
        },
      },
    });
    const session = await serviceWithStream.start({
      learnerId,
      scenarioId: scenario.id,
    });
    await serviceWithStream.sendMessage({
      learnerId,
      sessionId: session.id,
      content: "我先了解宠物年龄、体重和当前饮食。",
    });

    const completionEvents: string[] = [];
    const phases: string[] = [];
    for await (const chunk of serviceWithStream.completeStream({
      learnerId,
      sessionId: session.id,
    })) {
      if ("phase" in chunk) phases.push(chunk.phase);
      if ("report" in chunk) {
        completionEvents.push("report");
        await expect(
          serviceWithStream.load({ learnerId, sessionId: session.id }),
        ).resolves.toMatchObject({ status: "completed" });
      }
      if ("session" in chunk) completionEvents.push("session");
    }

    expect(completionEvents).toEqual(["report", "session"]);
    expect(phases).toEqual(["analyzing", "scoring", "saving"]);
  });

  it("attaches a live risk alert to the learner message and persists it", async () => {
    const outputDir = await mkdtemp(
      join(tmpdir(), "scenario-training-risk-"),
    );
    const scenario = scenarioTemplates[0];
    const serviceWithRisk = new ScenarioTrainingService({
      store: new LocalScenarioSessionStore(outputDir),
      templates: {
        async listPublished() {
          return scenarioTemplates;
        },
        async getPublishedById(scenarioId) {
          return getScenarioTemplate(scenarioId) ?? null;
        },
      },
      conversationProvider: new MockConversationProvider(),
      evaluationProvider: new MockEvaluationProvider(),
      liveRiskProvider: new MockLiveRiskProvider(),
    });

    const session = await serviceWithRisk.start({
      learnerId,
      scenarioId: scenario.id,
    });

    const result = await serviceWithRisk.sendMessage({
      learnerId,
      sessionId: session.id,
      content: "这款粮保证不软便，您放心买就行。",
    });

    expect(result.riskAlert).not.toBeNull();
    expect(result.riskAlert?.severity).toBe("warning");
    expect(result.riskAlert?.riskLabel).toBe("绝对化产品承诺");
    const learnerMessage = result.session.messages.find(
      (message) =>
        message.role === "learner" &&
        message.content === "这款粮保证不软便，您放心买就行。",
    );
    expect(learnerMessage?.riskAlert).toEqual(result.riskAlert);

    const reloaded = await serviceWithRisk.load({
      learnerId,
      sessionId: session.id,
    });
    const reloadedLearner = reloaded.messages.find(
      (message) => message.role === "learner",
    );
    expect(reloadedLearner?.riskAlert).toEqual(result.riskAlert);
  });

  it("keeps the conversation flowing when the live risk provider throws", async () => {
    const outputDir = await mkdtemp(
      join(tmpdir(), "scenario-training-risk-fallback-"),
    );
    const scenario = scenarioTemplates[0];
    const throwingProvider: import("./providers").LiveRiskProvider = {
      async detectRisk() {
        throw new Error("网络异常");
      },
    };
    const serviceWithThrowingRisk = new ScenarioTrainingService({
      store: new LocalScenarioSessionStore(outputDir),
      templates: {
        async listPublished() {
          return scenarioTemplates;
        },
        async getPublishedById(scenarioId) {
          return getScenarioTemplate(scenarioId) ?? null;
        },
      },
      conversationProvider: new MockConversationProvider(),
      evaluationProvider: new MockEvaluationProvider(),
      liveRiskProvider: throwingProvider,
    });

    const session = await serviceWithThrowingRisk.start({
      learnerId,
      scenarioId: scenario.id,
    });

    const result = await serviceWithThrowingRisk.sendMessage({
      learnerId,
      sessionId: session.id,
      content: "想先了解狗狗的体重和现在怎么喂。",
    });

    expect(result.riskAlert).toBeNull();
    expect(result.customerChunks.length).toBeGreaterThan(0);
    expect(result.session.learnerTurnCount).toBe(1);
  });

  it("returns learner recap progress without loading conversation messages", async () => {
    const scenario = scenarioTemplates[0];
    const session = await service.start({
      learnerId,
      scenarioId: scenario.id,
    });

    const progress = await service.getProgress({
      learnerId,
      publishedScenarioCount: scenarioTemplates.length,
    });

    expect(progress).toMatchObject({
      publishedScenarioCount: scenarioTemplates.length,
      completedScenarioCount: 0,
      completedSessionCount: 0,
    });
    expect(progress.activeSessions).toEqual([
      expect.objectContaining({ id: session.id, status: "active" }),
    ]);
    expect(progress.activeSessions[0]).not.toHaveProperty("messages");
  });
});
