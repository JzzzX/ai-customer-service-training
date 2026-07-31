import { randomUUID } from "node:crypto";
import { readFile, mkdir, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { z } from "zod";

import {
  scenarioEvaluationReportSchema,
  scenarioSessionSchema,
} from "./schema";
import type {
  ScenarioSession,
} from "./schema";
import type {
  AppendScenarioExchangeInput,
  CompleteScenarioSessionInput,
  ScenarioSessionStore,
  SessionIdentity,
  StartScenarioSessionInput,
} from "./session-store";

export class LocalScenarioSessionStore implements ScenarioSessionStore {
  private readonly outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = resolve(outputDir);
  }

  async startSession(
    input: StartScenarioSessionInput,
  ): Promise<ScenarioSession> {
    const learnerId = z.string().uuid().parse(input.learnerId);
    const startedAt = input.startedAt ?? new Date().toISOString();
    const session = scenarioSessionSchema.parse({
      id: randomUUID(),
      learnerId,
      scenarioId: input.scenario.id,
      scenarioVersionId: input.scenario.versionId,
      status: "active",
      mode: input.mode,
      learnerTurnCount: 0,
      maxTurns: input.scenario.maxTurns,
      messages: [
        {
          id: randomUUID(),
          role: "customer",
          content: input.scenario.openingMessage,
          createdAt: startedAt,
        },
      ],
      startedAt,
      updatedAt: startedAt,
    });

    await this.writeSession(session);
    return session;
  }

  async loadSession(input: SessionIdentity): Promise<ScenarioSession> {
    const sessionId = z.string().uuid().parse(input.sessionId);
    const learnerId = z.string().uuid().parse(input.learnerId);
    const session = scenarioSessionSchema.parse(
      JSON.parse(
        await readFile(this.sessionPath(sessionId), "utf8"),
      ),
    );
    if (session.learnerId !== learnerId) {
      throw new Error("无权访问该训练会话。");
    }
    return session;
  }

  async appendExchange(
    input: AppendScenarioExchangeInput,
  ): Promise<ScenarioSession> {
    const session = await this.loadSession(input);
    if (session.status === "completed") {
      throw new Error("已完成的训练不能继续发送消息。");
    }
    if (session.learnerTurnCount !== input.expectedTurnCount) {
      throw new Error("会话已更新，请刷新后重试。");
    }
    if (session.learnerTurnCount >= session.maxTurns) {
      throw new Error("训练已达到最大轮次。");
    }

    const updatedAt = input.updatedAt ?? new Date().toISOString();
    const learnerMessage = z.string().trim().min(1).parse(
      input.learnerMessage,
    );
    const customerReply = z.string().trim().min(1).parse(
      input.customerReply,
    );
    const updated = scenarioSessionSchema.parse({
      ...session,
      learnerTurnCount: session.learnerTurnCount + 1,
      messages: [
        ...session.messages,
        {
          id: randomUUID(),
          role: "learner",
          content: learnerMessage,
          createdAt: updatedAt,
          ...(input.riskAlert ? { riskAlert: input.riskAlert } : {}),
        },
        {
          id: randomUUID(),
          role: "customer",
          content: customerReply,
          createdAt: updatedAt,
        },
      ],
      updatedAt,
    });

    await this.writeSession(updated);
    return updated;
  }

  async completeSession(
    input: CompleteScenarioSessionInput,
  ): Promise<ScenarioSession> {
    const session = await this.loadSession(input);
    if (session.status === "completed") {
      return session;
    }
    const completedAt = input.completedAt ?? new Date().toISOString();
    const completed = scenarioSessionSchema.parse({
      ...session,
      status: "completed",
      report: scenarioEvaluationReportSchema.parse(input.report),
      completedAt,
      updatedAt: completedAt,
    });

    await this.writeSession(completed);
    return completed;
  }

  private sessionPath(sessionId: string): string {
    return join(this.outputDir, `session-${sessionId}.json`);
  }

  private async writeSession(session: ScenarioSession): Promise<void> {
    await mkdir(this.outputDir, { recursive: true });
    const path = this.sessionPath(session.id);
    const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(
      temporaryPath,
      `${JSON.stringify(session, null, 2)}\n`,
      "utf8",
    );
    await rename(temporaryPath, path);
  }
}
