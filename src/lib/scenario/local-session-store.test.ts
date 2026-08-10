import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { LocalScenarioSessionStore } from "./local-session-store";
import { MockEvaluationProvider } from "./mock-providers";
import { scenarioTemplates } from "./templates";

const learnerA = "00000000-0000-4000-8000-000000000002";
const learnerB = "00000000-0000-4000-8000-000000000003";

describe("LocalScenarioSessionStore", () => {
  let outputDir: string;

  beforeEach(async () => {
    outputDir = await mkdtemp(join(tmpdir(), "scenario-session-store-"));
  });

  it("starts a recoverable session with the customer opening message", async () => {
    const scenario = scenarioTemplates[0];
    const store = new LocalScenarioSessionStore(outputDir);
    const session = await store.startSession({
      learnerId: learnerA,
      scenario,
      mode: "mock",
      startedAt: "2026-07-29T08:00:00.000Z",
    });

    expect(session).toMatchObject({
      learnerId: learnerA,
      scenarioId: scenario.id,
      scenarioVersionId: scenario.versionId,
      status: "active",
      mode: "mock",
      learnerTurnCount: 0,
    });
    expect(session.messages).toEqual([
      expect.objectContaining({
        role: "customer",
        content: scenario.openingMessage,
        createdAt: "2026-07-29T08:00:00.000Z",
      }),
    ]);
    await expect(
      new LocalScenarioSessionStore(outputDir).loadSession({
        learnerId: learnerA,
        sessionId: session.id,
      }),
    ).resolves.toEqual(session);
  });

  it("records the runtime provider mode instead of the template mock flag", async () => {
    const scenario = scenarioTemplates[0];
    expect(scenario.mockMode).toBe(true);
    const session = await new LocalScenarioSessionStore(
      outputDir,
    ).startSession({
      learnerId: learnerA,
      scenario,
      mode: "real",
    });

    expect(session.mode).toBe("real");
  });

  it("atomically appends one learner/customer exchange", async () => {
    const store = new LocalScenarioSessionStore(outputDir);
    const session = await store.startSession({
      learnerId: learnerA,
      scenario: scenarioTemplates[0],
      mode: "mock",
      startedAt: "2026-07-29T08:00:00.000Z",
    });

    const updated = await store.appendExchange({
      learnerId: learnerA,
      sessionId: session.id,
      expectedTurnCount: 0,
      learnerMessage: "请问狗狗多大、体重多少？",
      customerReply: "刚满3个月，体重大概2.1公斤。",
      updatedAt: "2026-07-29T08:01:00.000Z",
    });

    expect(updated.learnerTurnCount).toBe(1);
    expect(updated.messages.map((message) => message.role)).toEqual([
      "customer",
      "learner",
      "customer",
    ]);
    expect(updated.messages[1]).toMatchObject({
      content: "请问狗狗多大、体重多少？",
      createdAt: "2026-07-29T08:01:00.000Z",
    });
    expect(updated.messages[2]).toMatchObject({
      content: "刚满3个月，体重大概2.1公斤。",
      createdAt: "2026-07-29T08:01:00.000Z",
    });
  });

  it("persists and reloads a live risk alert on the learner message", async () => {
    const store = new LocalScenarioSessionStore(outputDir);
    const session = await store.startSession({
      learnerId: learnerA,
      scenario: scenarioTemplates[0],
      mode: "mock",
      startedAt: "2026-07-29T08:00:00.000Z",
    });
    const riskAlert = {
      riskLabel: "绝对化产品承诺",
      suggestion: "避免使用「保证不软便」类表述。",
      severity: "warning" as const,
    };

    const updated = await store.appendExchange({
      learnerId: learnerA,
      sessionId: session.id,
      expectedTurnCount: 0,
      learnerMessage: "这款粮保证不软便。",
      customerReply: "好吧，那需要怎么换粮？",
      riskAlert,
      updatedAt: "2026-07-29T08:01:00.000Z",
    });

    expect(updated.messages[1].riskAlert).toEqual(riskAlert);

    const reloaded = await new LocalScenarioSessionStore(
      outputDir,
    ).loadSession({ learnerId: learnerA, sessionId: session.id });
    expect(reloaded.messages[1].riskAlert).toEqual(riskAlert);
  });

  it("isolates learner ownership and locks completed sessions", async () => {
    const store = new LocalScenarioSessionStore(outputDir);
    const scenario = scenarioTemplates[0];
    const session = await store.startSession({
      learnerId: learnerA,
      scenario,
      mode: "mock",
      startedAt: "2026-07-29T08:00:00.000Z",
    });
    const report = await new MockEvaluationProvider().evaluate({
      scenario,
      learnerMessages: ["年龄和预算"],
    });

    await expect(
      store.loadSession({
        learnerId: learnerB,
        sessionId: session.id,
      }),
    ).rejects.toThrow("无权访问该训练会话");
    const completed = await store.completeSession({
      learnerId: learnerA,
      sessionId: session.id,
      report,
      completedAt: "2026-07-29T08:02:00.000Z",
    });
    expect(completed.status).toBe("completed");
    expect(completed.report).toEqual(report);
    await expect(
      store.appendExchange({
        learnerId: learnerA,
        sessionId: session.id,
        expectedTurnCount: 0,
        learnerMessage: "继续",
        customerReply: "继续",
      }),
    ).rejects.toThrow("已完成的训练不能继续发送消息");
  });

  it("lists learner session summaries without exposing chat messages", async () => {
    const store = new LocalScenarioSessionStore(outputDir);
    const first = await store.startSession({
      learnerId: learnerA,
      scenario: scenarioTemplates[0]!,
      mode: "mock",
      startedAt: "2026-08-01T08:00:00.000Z",
    });
    const second = await store.startSession({
      learnerId: learnerA,
      scenario: scenarioTemplates[1]!,
      mode: "mock",
      startedAt: "2026-08-02T08:00:00.000Z",
    });
    const report = await new MockEvaluationProvider().evaluate({
      scenario: scenarioTemplates[0]!,
      learnerMessages: ["先确认情况"],
    });
    await store.completeSession({
      learnerId: learnerA,
      sessionId: first.id,
      report,
      completedAt: "2026-08-03T08:00:00.000Z",
    });

    const summaries = await store.listSessions({ learnerId: learnerA });

    expect(summaries).toHaveLength(2);
    expect(summaries[0]).toMatchObject({
      id: first.id,
      title: scenarioTemplates[0]!.title,
      status: "completed",
      score: report.totalScore,
    });
    expect(summaries[0]).not.toHaveProperty("messages");
    expect(summaries[1]).toMatchObject({
      id: second.id,
      title: scenarioTemplates[1]!.title,
      status: "active",
    });
    await expect(
      store.listSessions({ learnerId: learnerB }),
    ).resolves.toEqual([]);
  });

  it("keeps listing legacy completed sessions with an older report shape", async () => {
    const legacySession = {
      id: "00000000-0000-4000-8000-000000000030",
      learnerId: learnerA,
      scenarioId: scenarioTemplates[0]!.id,
      scenarioVersionId: scenarioTemplates[0]!.versionId,
      status: "completed",
      mode: "mock",
      learnerTurnCount: 1,
      maxTurns: scenarioTemplates[0]!.maxTurns,
      messages: [
        {
          id: "00000000-0000-4000-8000-000000000031",
          role: "customer",
          content: scenarioTemplates[0]!.openingMessage,
          createdAt: "2026-08-03T08:00:00.000Z",
        },
      ],
      report: {
        mode: "mock",
        totalScore: 72,
        status: "passed",
        confidence: 0.8,
        dimensions: [],
        strengths: [],
        missedSteps: [],
        risks: [],
        recommendations: ["旧版建议文本"],
        referenceReply: "旧版参考回复",
        lowConfidence: false,
      },
      startedAt: "2026-08-03T08:00:00.000Z",
      updatedAt: "2026-08-03T08:02:00.000Z",
      completedAt: "2026-08-03T08:02:00.000Z",
    };
    await writeFile(
      join(outputDir, `session-${legacySession.id}.json`),
      JSON.stringify(legacySession),
      "utf8",
    );

    await expect(
      new LocalScenarioSessionStore(outputDir).listSessions({
        learnerId: learnerA,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: legacySession.id,
        status: "completed",
        score: 72,
        verdict: "passed",
      }),
    ]);
  });

  it("normalizes legacy string recommendations when opening a saved report", async () => {
    const store = new LocalScenarioSessionStore(outputDir);
    const scenario = scenarioTemplates[0]!;
    const session = await store.startSession({
      learnerId: learnerA,
      scenario,
      mode: "mock",
    });
    const report = await new MockEvaluationProvider().evaluate({
      scenario,
      learnerMessages: ["年龄、体重和预算"],
    });
    await store.completeSession({
      learnerId: learnerA,
      sessionId: session.id,
      report,
    });
    const path = join(outputDir, `session-${session.id}.json`);
    const raw = JSON.parse(await readFile(path, "utf8"));
    raw.report.recommendations = raw.report.recommendations.map(
      (recommendation: { suggestedReply: string }) => recommendation.suggestedReply,
    );
    await writeFile(path, JSON.stringify(raw), "utf8");

    const loaded = await store.loadSession({
      learnerId: learnerA,
      sessionId: session.id,
    });
    expect(loaded.report?.recommendations[0]).toEqual(
      expect.objectContaining({ suggestedReply: expect.any(String) }),
    );
  });
});
