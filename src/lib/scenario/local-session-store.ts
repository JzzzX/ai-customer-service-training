import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";

import { z } from "zod";

import {
  scenarioEvaluationReportSchema,
  scenarioSessionSchema,
} from "./schema";
import { scenarioTemplates } from "./templates";
import type {
  ScenarioSession,
} from "./schema";
import type {
  AppendScenarioExchangeInput,
  CompleteScenarioSessionInput,
  ScenarioSessionStore,
  ScenarioSessionSummary,
  SessionIdentity,
  StartScenarioSessionInput,
} from "./session-store";

const scenarioSessionSummaryFileSchema = z.object({
  id: z.string().uuid(),
  learnerId: z.string().uuid(),
  scenarioId: z.string().min(1),
  scenarioVersionId: z.string().min(1),
  status: z.enum(["active", "completed"]),
  mode: z.enum(["mock", "real"]),
  learnerTurnCount: z.number().int().min(0),
  maxTurns: z.number().int().positive(),
  startedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  report: z
    .object({
      totalScore: z.number().int().min(0).max(100),
      status: z.enum(["passed", "needs_retry"]),
    })
    .optional(),
});

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
      normalizeLegacyScenarioSession(
        JSON.parse(await readFile(this.sessionPath(sessionId), "utf8")),
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

  async listSessions(input: {
    learnerId: string;
    limit?: number;
  }): Promise<ScenarioSessionSummary[]> {
    const learnerId = z.string().uuid().parse(input.learnerId);
    let names: string[];
    try {
      names = await readdir(this.outputDir);
    } catch {
      return [];
    }
    const paths = names
      .filter(
        (name) => name.startsWith("session-") && name.endsWith(".json"),
      )
      .map((name) => join(this.outputDir, name));
    const sessions = await Promise.all(
      paths.map(async (path) => {
        try {
          const parsed = scenarioSessionSummaryFileSchema.safeParse(
            JSON.parse(await readFile(path, "utf8")),
          );
          return parsed.success ? parsed.data : null;
        } catch {
          return null;
        }
      }),
    );
    const summaries = sessions
      .filter(
        (session): session is z.infer<typeof scenarioSessionSummaryFileSchema> =>
          session !== null && session.learnerId === learnerId,
      )
      .map(toScenarioSessionSummary)
      .sort(compareSummariesDescending);
    return input.limit === undefined
      ? summaries
      : summaries.slice(0, input.limit);
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

function toScenarioSessionSummary(
  session: z.infer<typeof scenarioSessionSummaryFileSchema>,
): ScenarioSessionSummary {
  const scenario = scenarioTemplates.find(
    (candidate) => candidate.id === session.scenarioId,
  );
  return {
    id: session.id,
    learnerId: session.learnerId,
    scenarioId: session.scenarioId,
    scenarioVersionId: session.scenarioVersionId,
    title: scenario?.title ?? "情景实战",
    category: scenario?.category ?? "presale",
    status: session.status,
    mode: session.mode,
    learnerTurnCount: session.learnerTurnCount,
    maxTurns: session.maxTurns,
    startedAt: session.startedAt,
    updatedAt: session.updatedAt,
    ...(session.completedAt ? { completedAt: session.completedAt } : {}),
    ...(session.report
      ? {
          score: session.report.totalScore,
          verdict: session.report.status,
        }
      : {}),
  };
}

function normalizeLegacyScenarioSession(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }
  const session = value as Record<string, unknown>;
  const report = session.report;
  if (!report || typeof report !== "object") {
    return value;
  }
  const reportRecord = report as Record<string, unknown>;
  const recommendations = reportRecord.recommendations;
  if (
    !Array.isArray(recommendations) ||
    !recommendations.some((recommendation) => typeof recommendation === "string")
  ) {
    return value;
  }
  return {
    ...session,
    report: {
      ...reportRecord,
      recommendations: recommendations.map((recommendation) =>
        typeof recommendation === "string"
          ? { issue: "改进建议", suggestedReply: recommendation }
          : recommendation,
      ),
    },
  };
}

function compareSummariesDescending(
  left: ScenarioSessionSummary,
  right: ScenarioSessionSummary,
): number {
  return (
    right.updatedAt.localeCompare(left.updatedAt) ||
    right.id.localeCompare(left.id)
  );
}
