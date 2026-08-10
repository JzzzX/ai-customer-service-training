import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  type SQL,
} from "drizzle-orm";

import type { DatabaseClient } from "../client";
import {
  evaluationReports,
  reviewDecisions,
  scenarios,
  scenarioVersions,
  trainingMessages,
  trainingSessions,
  users,
} from "../schema";
import {
  reviewDecisionInputSchema,
  trainingReviewItemSchema,
  type ReviewDecisionInput,
  type TrainingReviewItem,
} from "@/lib/training/review-schema";
import type { ReviewStore } from "@/lib/training/review-store";

type ReviewRow = Awaited<
  ReturnType<DbReviewStore["selectReviewRows"]>
>[number];

export class DbReviewStore implements ReviewStore {
  constructor(private readonly database: DatabaseClient) {}

  async listPending(): Promise<TrainingReviewItem[]> {
    const rows = await this.selectReviewRows([
      eq(evaluationReports.needsReview, true),
      isNull(reviewDecisions.id),
    ]);
    return Promise.all(rows.map((row) => this.mapReview(row)));
  }

  async load(reportId: string): Promise<TrainingReviewItem | null> {
    const [row] = await this.selectReviewRows([
      eq(evaluationReports.id, reportId),
    ]);
    return row ? this.mapReview(row) : null;
  }

  async decide(
    inputValue: ReviewDecisionInput,
  ): Promise<TrainingReviewItem> {
    const input = reviewDecisionInputSchema.parse(inputValue);
    const [reviewer] = await this.database
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.id, input.reviewerId),
          eq(users.role, "admin"),
          eq(users.isActive, true),
        ),
      )
      .limit(1);
    if (!reviewer) {
      throw new Error("复核管理员不存在或未启用。");
    }

    const [report] = await this.database
      .select({ id: evaluationReports.id })
      .from(evaluationReports)
      .where(
        and(
          eq(evaluationReports.id, input.reportId),
          eq(evaluationReports.needsReview, true),
        ),
      )
      .limit(1);
    if (!report) {
      throw new Error("报告不存在或无需复核。");
    }

    const [inserted] = await this.database
      .insert(reviewDecisions)
      .values({
        evaluationReportId: input.reportId,
        reviewerId: input.reviewerId,
        status: input.status,
        correctedVerdict: input.correctedVerdict ?? null,
        correctedScore: input.correctedScore ?? null,
        comment: input.comment,
      })
      .onConflictDoNothing({
        target: reviewDecisions.evaluationReportId,
      })
      .returning({ id: reviewDecisions.id });

    if (!inserted) {
      const [existing] = await this.database
        .select({
          reviewerId: reviewDecisions.reviewerId,
          status: reviewDecisions.status,
          correctedVerdict: reviewDecisions.correctedVerdict,
          correctedScore: reviewDecisions.correctedScore,
          comment: reviewDecisions.comment,
        })
        .from(reviewDecisions)
        .where(
          eq(reviewDecisions.evaluationReportId, input.reportId),
        )
        .limit(1);
      if (!existing || !isSameDecision(existing, input)) {
        throw new Error("该报告已有复核结论，不能重复覆盖。");
      }
    }

    const reviewed = await this.load(input.reportId);
    if (!reviewed) {
      throw new Error("复核结论写入后读取失败。");
    }
    return reviewed;
  }

  private selectReviewRows(conditions: SQL[]) {
    return this.database
      .select({
        reportId: evaluationReports.id,
        sessionId: trainingSessions.id,
        learnerId: trainingSessions.learnerId,
        learnerName: users.name,
        scenarioTitle: scenarios.title,
        totalScore: evaluationReports.totalScore,
        verdict: evaluationReports.verdict,
        confidence: evaluationReports.confidence,
        dimensions: evaluationReports.dimensions,
        strengths: evaluationReports.strengths,
        missedSteps: evaluationReports.omissions,
        risks: evaluationReports.risks,
        recommendations: evaluationReports.recommendations,
        referenceReply: evaluationReports.sampleReply,
        reviewTrigger: evaluationReports.reviewTrigger,
        createdAt: evaluationReports.createdAt,
        decisionReviewerId: reviewDecisions.reviewerId,
        decisionStatus: reviewDecisions.status,
        correctedVerdict: reviewDecisions.correctedVerdict,
        correctedScore: reviewDecisions.correctedScore,
        decisionComment: reviewDecisions.comment,
      })
      .from(evaluationReports)
      .innerJoin(
        trainingSessions,
        eq(
          evaluationReports.trainingSessionId,
          trainingSessions.id,
        ),
      )
      .innerJoin(users, eq(trainingSessions.learnerId, users.id))
      .innerJoin(
        scenarioVersions,
        eq(
          trainingSessions.scenarioVersionId,
          scenarioVersions.id,
        ),
      )
      .innerJoin(
        scenarios,
        eq(scenarioVersions.scenarioId, scenarios.id),
      )
      .leftJoin(
        reviewDecisions,
        eq(
          reviewDecisions.evaluationReportId,
          evaluationReports.id,
        ),
      )
      .where(and(...conditions))
      .orderBy(
        desc(evaluationReports.createdAt),
        desc(evaluationReports.id),
      );
  }

  private async mapReview(row: ReviewRow): Promise<TrainingReviewItem> {
    const transcript = await this.database
      .select({
        role: trainingMessages.sender,
        content: trainingMessages.content,
        createdAt: trainingMessages.createdAt,
      })
      .from(trainingMessages)
      .where(
        and(
          eq(trainingMessages.trainingSessionId, row.sessionId),
          inArray(trainingMessages.sender, ["customer", "learner"]),
        ),
      )
      .orderBy(
        asc(trainingMessages.position),
        asc(trainingMessages.id),
      );

    const decision =
      row.decisionReviewerId &&
      row.decisionStatus &&
      row.decisionComment
        ? {
            reportId: row.reportId,
            reviewerId: row.decisionReviewerId,
            status: row.decisionStatus,
            ...(row.correctedVerdict
              ? { correctedVerdict: row.correctedVerdict }
              : {}),
            ...(row.correctedScore !== null
              ? { correctedScore: row.correctedScore }
              : {}),
            comment: row.decisionComment,
          }
        : undefined;

    return trainingReviewItemSchema.parse({
      reportId: row.reportId,
      learnerId: row.learnerId,
      learnerName: row.learnerName,
      scenarioTitle: row.scenarioTitle,
      totalScore: row.totalScore,
      verdict: row.verdict,
      confidence: Number(row.confidence),
      dimensions: row.dimensions,
      strengths: row.strengths,
      missedSteps: row.missedSteps,
      risks: row.risks,
      recommendations: row.recommendations,
      referenceReply: row.referenceReply,
      reviewTrigger: row.reviewTrigger,
      transcript: transcript.map((message) => ({
        role: message.role,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      })),
      createdAt: row.createdAt.toISOString(),
      ...(decision ? { decision } : {}),
    });
  }
}

function isSameDecision(
  existing: {
    reviewerId: string;
    status: "confirmed" | "adjusted" | "dismissed";
    correctedVerdict: "passed" | "needs_retry" | null;
    correctedScore: number | null;
    comment: string;
  },
  input: ReviewDecisionInput,
) {
  return (
    existing.reviewerId === input.reviewerId &&
    existing.status === input.status &&
    existing.correctedVerdict ===
      (input.correctedVerdict ?? null) &&
    existing.correctedScore === (input.correctedScore ?? null) &&
    existing.comment === input.comment
  );
}
