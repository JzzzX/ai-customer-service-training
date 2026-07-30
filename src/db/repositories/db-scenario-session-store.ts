import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import type { DatabaseClient } from "../client";
import {
  assignments,
  evaluationReports,
  scenarios,
  scenarioVersions,
  trainingMessages,
  trainingSessions,
} from "../schema";
import {
  scenarioEvaluationReportSchema,
  scenarioSessionSchema,
  type ScenarioEvaluationReport,
  type ScenarioSession,
} from "@/lib/scenario/schema";
import type {
  AppendScenarioExchangeInput,
  CompleteScenarioSessionInput,
  ScenarioSessionStore,
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
    const assignmentId = inputValue.assignmentId
      ? z.string().uuid().parse(inputValue.assignmentId)
      : undefined;
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
      .limit(1);
    if (!version) {
      throw new Error("场景版本不存在或未发布。");
    }
    if (version.maxTurns !== inputValue.scenario.maxTurns) {
      throw new Error("场景版本与训练模板不匹配。");
    }

    const sessionId = await this.database.transaction(
      async (transaction) => {
        if (assignmentId) {
          const [assignment] = await transaction
            .select({ id: assignments.id })
            .from(assignments)
            .where(
              and(
                eq(assignments.id, assignmentId),
                eq(assignments.learnerId, learnerId),
                eq(assignments.assignmentType, "scenario"),
                eq(assignments.scenarioVersionId, version.id),
              ),
            )
            .limit(1);
          if (!assignment) {
            throw new Error("训练任务不存在或不属于当前学员。");
          }
        }

        const [session] = await transaction
          .insert(trainingSessions)
          .values({
            assignmentId,
            learnerId,
            knowledgeVersionId: version.knowledgeVersionId,
            scenarioVersionId: version.id,
            status: "in_progress",
            mode: inputValue.scenario.mockMode ? "mock" : "real",
            turnCount: 0,
            startedAt,
            updatedAt: startedAt,
          })
          .returning({ id: trainingSessions.id });
        if (!session) {
          throw new Error("训练会话创建失败。");
        }
        await transaction.insert(trainingMessages).values({
          trainingSessionId: session.id,
          position: 0,
          sender: "customer",
          content: inputValue.scenario.openingMessage,
          createdAt: startedAt,
        });
        if (assignmentId) {
          await transaction
            .update(assignments)
            .set({ status: "in_progress", startedAt })
            .where(eq(assignments.id, assignmentId));
        }
        return session.id;
      },
    );
    return this.loadSession({ learnerId, sessionId });
  }

  async loadSession(inputValue: SessionIdentity): Promise<ScenarioSession> {
    const input = sessionIdentitySchema.parse(inputValue);
    const [session] = await this.database
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
      .limit(1);
    if (!session) {
      throw new Error("无权访问该训练会话。");
    }

    const messages = await this.database
      .select({
        id: trainingMessages.id,
        role: trainingMessages.sender,
        content: trainingMessages.content,
        createdAt: trainingMessages.createdAt,
      })
      .from(trainingMessages)
      .where(eq(trainingMessages.trainingSessionId, session.id))
      .orderBy(asc(trainingMessages.position));
    const [storedReport] = await this.database
      .select()
      .from(evaluationReports)
      .where(eq(evaluationReports.trainingSessionId, session.id))
      .limit(1);
    const report = storedReport
      ? scenarioEvaluationReportSchema.parse({
          mode: session.mode as "mock" | "real",
          totalScore: storedReport.totalScore,
          status: storedReport.verdict,
          confidence: Number(storedReport.confidence),
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
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      })),
      ...(report ? { report } : {}),
      startedAt: session.startedAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      ...(session.completedAt
        ? { completedAt: session.completedAt.toISOString() }
        : {}),
    });
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

    await this.database.transaction(async (transaction) => {
      const [current] = await transaction
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
        .limit(1);
      if (!current) {
        throw new Error("无权访问该训练会话。");
      }
      if (current.status !== "in_progress") {
        throw new Error("已完成的训练不能继续发送消息。");
      }
      if (expectedTurnCount >= current.maxTurns) {
        throw new Error("训练已达到最大轮次。");
      }

      const [updated] = await transaction
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
        .returning({ id: trainingSessions.id });
      if (!updated) {
        throw new Error("会话已更新，请刷新后重试。");
      }

      await transaction.insert(trainingMessages).values([
        {
          trainingSessionId: identity.sessionId,
          position: expectedTurnCount * 2 + 1,
          sender: "learner",
          content: learnerMessage,
          createdAt: updatedAt,
        },
        {
          trainingSessionId: identity.sessionId,
          position: expectedTurnCount * 2 + 2,
          sender: "customer",
          content: customerReply,
          createdAt: updatedAt,
        },
      ]);
    });

    return this.loadSession(identity);
  }

  async completeSession(
    inputValue: CompleteScenarioSessionInput,
  ): Promise<ScenarioSession> {
    const identity = sessionIdentitySchema.parse(inputValue);
    const report = scenarioEvaluationReportSchema.parse(inputValue.report);
    console.log("[DEBUG completeSession] report.lowConfidence =", report.lowConfidence);
    const completedAt = inputValue.completedAt
      ? new Date(inputValue.completedAt)
      : new Date();
    const existing = await this.loadSession(identity);
    if (existing.status === "completed") {
      return existing;
    }

    await this.database.transaction(async (transaction) => {
      const [current] = await transaction
        .select({
          id: trainingSessions.id,
          assignmentId: trainingSessions.assignmentId,
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
        .limit(1);
      if (!current) {
        return;
      }

      const reviewTrigger = determineReviewTrigger(
        identity.sessionId,
        report,
      );
      await transaction
        .insert(evaluationReports)
        .values({
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
          confidence: report.confidence.toFixed(3),
          lowConfidence: report.lowConfidence,
          needsReview: Boolean(reviewTrigger),
          reviewTrigger,
        })
        .onConflictDoNothing({
          target: evaluationReports.trainingSessionId,
        });
      await transaction
        .update(trainingSessions)
        .set({
          status:
            report.status === "passed" && !reviewTrigger
              ? "completed"
              : "needs_review",
          completedAt,
          updatedAt: completedAt,
        })
        .where(
          and(
            eq(trainingSessions.id, current.id),
            eq(trainingSessions.status, "in_progress"),
          ),
        );
      if (current.assignmentId) {
        await transaction
          .update(assignments)
          .set({ status: "completed", completedAt })
          .where(
            and(
              eq(assignments.id, current.assignmentId),
              eq(assignments.learnerId, identity.learnerId),
            ),
          );
      }
    });

    return this.loadSession(identity);
  }
}

function determineReviewTrigger(
  sessionId: string,
  report: ScenarioEvaluationReport,
):
  | "critical_risk"
  | "low_confidence"
  | "failed"
  | "random_sample"
  | null {
  if (report.risks.length > 0) {
    return "critical_risk";
  }
  if (report.confidence < 0.8) {
    return "low_confidence";
  }
  if (report.status === "needs_retry") {
    return "failed";
  }
  const sampleByte = Number.parseInt(sessionId.replaceAll("-", "").slice(-2), 16);
  return sampleByte % 10 === 0 ? "random_sample" : null;
}
