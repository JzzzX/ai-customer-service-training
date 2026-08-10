import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import type { DatabaseClient } from "../client";
import {
  evaluationReports,
  scenarios,
  scenarioVersions,
  trainingMessages,
  trainingSessions,
} from "../schema";
import {
  scenarioEvaluationReportSchema,
  scenarioCategorySchema,
  scenarioSessionSchema,
  type LiveRiskAlert,
  type ScenarioSession,
} from "@/lib/scenario/schema";
import type {
  AppendScenarioExchangeInput,
  CompleteScenarioSessionInput,
  ScenarioSessionStore,
  ScenarioSessionSummary,
  SessionIdentity,
  StartScenarioSessionInput,
} from "@/lib/scenario/session-store";

const sessionIdentitySchema = z.object({
  learnerId: z.string().uuid(),
  sessionId: z.string().uuid(),
});

export class DbScenarioSessionStore implements ScenarioSessionStore {
  constructor(private readonly database: DatabaseClient) {}

  async startSession(
    inputValue: StartScenarioSessionInput,
  ): Promise<ScenarioSession> {
    const learnerId = z.string().uuid().parse(inputValue.learnerId);
    const startedAt = inputValue.startedAt
      ? new Date(inputValue.startedAt)
      : new Date();
    const [version] = await this.database
      .select({
        id: scenarioVersions.id,
        knowledgeVersionId: scenarioVersions.knowledgeVersionId,
        maxTurns: scenarioVersions.maxTurns,
      })
      .from(scenarioVersions)
      .innerJoin(
        scenarios,
        eq(scenarioVersions.scenarioId, scenarios.id),
      )
      .where(
        and(
          eq(scenarios.scenarioKey, inputValue.scenario.id),
          eq(
            scenarioVersions.versionKey,
            inputValue.scenario.versionId,
          ),
          eq(scenarios.status, "published"),
          eq(scenarioVersions.status, "published"),
        ),
      )
      .limit(1).all();
    if (!version) {
      throw new Error("场景版本不存在或未发布。");
    }
    if (version.maxTurns !== inputValue.scenario.maxTurns) {
      throw new Error("场景版本与训练模板不匹配。");
    }

    const sessionId = randomUUID();
    this.database.transaction((transaction) => {
      transaction.insert(trainingSessions).values({
        id: sessionId,
        learnerId,
        knowledgeVersionId: version.knowledgeVersionId,
        scenarioVersionId: version.id,
        status: "in_progress",
        mode: inputValue.mode,
        turnCount: 0,
        startedAt,
        updatedAt: startedAt,
      }).run();
      transaction.insert(trainingMessages).values({
          id: randomUUID(),
          trainingSessionId: sessionId,
          position: 0,
          sender: "customer",
          content: inputValue.scenario.openingMessage,
          createdAt: startedAt,
      }).run();
    });
    return this.loadSession({ learnerId, sessionId });
  }

  async loadSession(inputValue: SessionIdentity): Promise<ScenarioSession> {
    const input = sessionIdentitySchema.parse(inputValue);
    const [sessionRows, messages, reportRows] = await Promise.all([
      this.database
        .select({
          id: trainingSessions.id,
          learnerId: trainingSessions.learnerId,
          scenarioId: scenarios.scenarioKey,
          scenarioVersionId: scenarioVersions.versionKey,
          status: trainingSessions.status,
          mode: trainingSessions.mode,
          turnCount: trainingSessions.turnCount,
          maxTurns: scenarioVersions.maxTurns,
          startedAt: trainingSessions.startedAt,
          updatedAt: trainingSessions.updatedAt,
          completedAt: trainingSessions.completedAt,
        })
        .from(trainingSessions)
        .innerJoin(
          scenarioVersions,
          eq(trainingSessions.scenarioVersionId, scenarioVersions.id),
        )
        .innerJoin(
          scenarios,
          eq(scenarioVersions.scenarioId, scenarios.id),
        )
        .where(
          and(
            eq(trainingSessions.id, input.sessionId),
            eq(trainingSessions.learnerId, input.learnerId),
          ),
        )
        .limit(1)
        .all(),
      this.database
        .select({
          id: trainingMessages.id,
          role: trainingMessages.sender,
          content: trainingMessages.content,
          createdAt: trainingMessages.createdAt,
          metadata: trainingMessages.metadata,
        })
        .from(trainingMessages)
        .where(eq(trainingMessages.trainingSessionId, input.sessionId))
        .orderBy(asc(trainingMessages.position))
        .all(),
      this.database
        .select()
        .from(evaluationReports)
        .where(eq(evaluationReports.trainingSessionId, input.sessionId))
        .limit(1)
        .all(),
    ]);
    const session = sessionRows[0];
    if (!session) {
      throw new Error("无权访问该训练会话。");
    }
    const storedReport = reportRows[0];
    const report = storedReport
      ? scenarioEvaluationReportSchema.parse({
          mode: session.mode as "mock" | "real",
          totalScore: storedReport.totalScore,
          status: storedReport.verdict,
          confidence: storedReport.confidence,
          dimensions: storedReport.dimensions,
          strengths: storedReport.strengths,
          missedSteps: storedReport.omissions,
          risks: storedReport.risks,
          recommendations: storedReport.recommendations,
          referenceReply: storedReport.sampleReply,
          lowConfidence: storedReport.lowConfidence,
        })
      : undefined;
    const isCompleted = session.status !== "in_progress";

    return scenarioSessionSchema.parse({
      id: session.id,
      learnerId: session.learnerId,
      scenarioId: session.scenarioId,
      scenarioVersionId: session.scenarioVersionId,
      status: isCompleted ? "completed" : "active",
      mode: session.mode as "mock" | "real",
      learnerTurnCount: session.turnCount,
      maxTurns: session.maxTurns,
      messages: messages.map((message) => {
        const riskAlert = extractRiskAlert(message.metadata);
        return {
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt: message.createdAt.toISOString(),
          ...(riskAlert ? { riskAlert } : {}),
        };
      }),
      ...(report ? { report } : {}),
      startedAt: session.startedAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      ...(session.completedAt
        ? { completedAt: session.completedAt.toISOString() }
        : {}),
    });
  }

  async listSessions(input: {
    learnerId: string;
    limit?: number;
  }): Promise<ScenarioSessionSummary[]> {
    const learnerId = z.string().uuid().parse(input.learnerId);
    const query = this.database
      .select({
        id: trainingSessions.id,
        learnerId: trainingSessions.learnerId,
        scenarioId: scenarios.scenarioKey,
        scenarioVersionId: scenarioVersions.versionKey,
        title: scenarios.title,
        category: scenarios.category,
        status: trainingSessions.status,
        mode: trainingSessions.mode,
        learnerTurnCount: trainingSessions.turnCount,
        maxTurns: scenarioVersions.maxTurns,
        startedAt: trainingSessions.startedAt,
        updatedAt: trainingSessions.updatedAt,
        completedAt: trainingSessions.completedAt,
        score: evaluationReports.totalScore,
        verdict: evaluationReports.verdict,
      })
      .from(trainingSessions)
      .innerJoin(
        scenarioVersions,
        eq(trainingSessions.scenarioVersionId, scenarioVersions.id),
      )
      .innerJoin(
        scenarios,
        eq(scenarioVersions.scenarioId, scenarios.id),
      )
      .leftJoin(
        evaluationReports,
        eq(evaluationReports.trainingSessionId, trainingSessions.id),
      )
      .where(
        and(
          eq(trainingSessions.learnerId, learnerId),
          inArray(trainingSessions.status, [
            "in_progress",
            "completed",
          ]),
        ),
      )
      .orderBy(desc(trainingSessions.updatedAt), desc(trainingSessions.id));
    const rows = input.limit === undefined
      ? query.all()
      : query.limit(input.limit).all();

    return rows.map((row) => ({
      id: row.id,
      learnerId: row.learnerId,
      scenarioId: row.scenarioId,
      scenarioVersionId: row.scenarioVersionId,
      title: row.title,
      category: scenarioCategorySchema.parse(row.category),
      status: row.status === "in_progress" ? "active" : "completed",
      mode: scenarioSessionSchema.shape.mode.parse(row.mode),
      learnerTurnCount: row.learnerTurnCount,
      maxTurns: row.maxTurns,
      startedAt: row.startedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      ...(row.completedAt
        ? { completedAt: row.completedAt.toISOString() }
        : {}),
      ...(row.score !== null && row.score !== undefined
        ? { score: row.score }
        : {}),
      ...(row.verdict ? { verdict: row.verdict } : {}),
    }));
  }

  async appendExchange(
    inputValue: AppendScenarioExchangeInput,
  ): Promise<ScenarioSession> {
    const identity = sessionIdentitySchema.parse(inputValue);
    const expectedTurnCount = z
      .number()
      .int()
      .nonnegative()
      .parse(inputValue.expectedTurnCount);
    const learnerMessage = z
      .string()
      .trim()
      .min(1)
      .parse(inputValue.learnerMessage);
    const customerReply = z
      .string()
      .trim()
      .min(1)
      .parse(inputValue.customerReply);
    const updatedAt = inputValue.updatedAt
      ? new Date(inputValue.updatedAt)
      : new Date();
    const riskAlert = inputValue.riskAlert ?? null;

    this.database.transaction((transaction) => {
      const [current] = transaction
        .select({
          status: trainingSessions.status,
          maxTurns: scenarioVersions.maxTurns,
        })
        .from(trainingSessions)
        .innerJoin(
          scenarioVersions,
          eq(trainingSessions.scenarioVersionId, scenarioVersions.id),
        )
        .where(
          and(
            eq(trainingSessions.id, identity.sessionId),
            eq(trainingSessions.learnerId, identity.learnerId),
          ),
        )
        .limit(1).all();
      if (!current) {
        throw new Error("无权访问该训练会话。");
      }
      if (current.status !== "in_progress") {
        throw new Error("已完成的训练不能继续发送消息。");
      }
      if (expectedTurnCount >= current.maxTurns) {
        throw new Error("训练已达到最大轮次。");
      }

      const [updated] = transaction
        .update(trainingSessions)
        .set({
          turnCount: expectedTurnCount + 1,
          updatedAt,
        })
        .where(
          and(
            eq(trainingSessions.id, identity.sessionId),
            eq(trainingSessions.learnerId, identity.learnerId),
            eq(trainingSessions.status, "in_progress"),
            eq(trainingSessions.turnCount, expectedTurnCount),
          ),
        )
        .returning({ id: trainingSessions.id }).all();
      if (!updated) {
        throw new Error("会话已更新，请刷新后重试。");
      }

      transaction.insert(trainingMessages).values([
        {
          id: randomUUID(),
          trainingSessionId: identity.sessionId,
          position: expectedTurnCount * 2 + 1,
          sender: "learner",
          content: learnerMessage,
          createdAt: updatedAt,
          metadata: riskAlert ? { riskAlert } : null,
        },
        {
          id: randomUUID(),
          trainingSessionId: identity.sessionId,
          position: expectedTurnCount * 2 + 2,
          sender: "customer",
          content: customerReply,
          createdAt: updatedAt,
        },
      ]).run();
    });

    return this.loadSession(identity);
  }

  async completeSession(
    inputValue: CompleteScenarioSessionInput,
  ): Promise<ScenarioSession> {
    const identity = sessionIdentitySchema.parse(inputValue);
    const report = scenarioEvaluationReportSchema.parse(inputValue.report);
    const completedAt = inputValue.completedAt
      ? new Date(inputValue.completedAt)
      : new Date();
    const [existing] = await this.database
      .select({ status: trainingSessions.status })
      .from(trainingSessions)
      .where(
        and(
          eq(trainingSessions.id, identity.sessionId),
          eq(trainingSessions.learnerId, identity.learnerId),
        ),
      )
      .limit(1).all();
    if (!existing) {
      throw new Error("无权访问该训练会话。");
    }
    if (existing.status !== "in_progress") {
      return this.loadSession(identity);
    }

    this.database.transaction((transaction) => {
      const [current] = transaction
        .select({
          id: trainingSessions.id,
          knowledgeVersionId: trainingSessions.knowledgeVersionId,
        })
        .from(trainingSessions)
        .where(
          and(
            eq(trainingSessions.id, identity.sessionId),
            eq(trainingSessions.learnerId, identity.learnerId),
            eq(trainingSessions.status, "in_progress"),
          ),
        )
        .limit(1).all();
      if (!current) {
        return;
      }

      transaction
        .insert(evaluationReports)
        .values({
          id: randomUUID(),
          trainingSessionId: current.id,
          knowledgeVersionId: current.knowledgeVersionId,
          totalScore: report.totalScore,
          verdict: report.status,
          dimensions: report.dimensions,
          strengths: report.strengths,
          omissions: report.missedSteps,
          risks: report.risks,
          recommendations: report.recommendations,
          turnFeedback: [],
          recommendedFlow: report.recommendations.map(
            (item) => item.suggestedReply,
          ),
          sampleReply: report.referenceReply,
          evidence: report.dimensions.map((dimension) => ({
            dimension: dimension.name,
            evidence: dimension.evidence,
          })),
          confidence: report.confidence,
          lowConfidence: report.lowConfidence,
        })
        .onConflictDoNothing({
          target: evaluationReports.trainingSessionId,
        }).run();
      transaction
        .update(trainingSessions)
        .set({
          status: "completed",
          completedAt,
          updatedAt: completedAt,
        })
        .where(
          and(
            eq(trainingSessions.id, current.id),
            eq(trainingSessions.status, "in_progress"),
          ),
        ).run();
    });

    return this.loadSession(identity);
  }
}

function extractRiskAlert(
  metadata: Record<string, unknown> | null,
): LiveRiskAlert | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }
  const raw = (metadata as { riskAlert?: unknown }).riskAlert;
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const alert = raw as Partial<LiveRiskAlert>;
  if (
    typeof alert.riskLabel !== "string" ||
    typeof alert.suggestion !== "string" ||
    (alert.severity !== "warning" && alert.severity !== "danger")
  ) {
    return null;
  }
  const riskLabel = alert.riskLabel.trim();
  const suggestion = alert.suggestion.trim();
  if (!riskLabel || !suggestion) {
    return null;
  }
  return { riskLabel, suggestion, severity: alert.severity };
}
