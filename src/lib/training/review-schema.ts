import { z } from "zod";

import { scenarioEvaluationReportSchema } from "@/lib/scenario/schema";

export const reviewDecisionInputSchema = z
  .object({
    reportId: z.string().uuid(),
    reviewerId: z.string().uuid(),
    status: z.enum(["confirmed", "adjusted", "dismissed"]),
    correctedVerdict: z.enum(["passed", "needs_retry"]).optional(),
    correctedScore: z.number().int().min(0).max(100).optional(),
    comment: z.string().trim().min(1).max(2000),
  })
  .superRefine((input, context) => {
    if (
      input.status === "adjusted" &&
      (input.correctedScore === undefined ||
        input.correctedVerdict === undefined)
    ) {
      context.addIssue({
        code: "custom",
        message: "调整结论必须填写修正分数和结论。",
      });
    }
    if (
      input.status !== "adjusted" &&
      (input.correctedScore !== undefined ||
        input.correctedVerdict !== undefined)
    ) {
      context.addIssue({
        code: "custom",
        message: "仅调整结论可以填写修正字段。",
      });
    }
  });

export const trainingReviewItemSchema = z.object({
  reportId: z.string().uuid(),
  learnerId: z.string().uuid(),
  learnerName: z.string().trim().min(1),
  scenarioTitle: z.string().trim().min(1),
  totalScore: z.number().int().min(0).max(100),
  verdict: z.enum(["passed", "needs_retry"]),
  confidence: z.number().min(0).max(1),
  dimensions: scenarioEvaluationReportSchema.shape.dimensions,
  strengths: scenarioEvaluationReportSchema.shape.strengths,
  missedSteps: scenarioEvaluationReportSchema.shape.missedSteps,
  risks: scenarioEvaluationReportSchema.shape.risks,
  recommendations:
    scenarioEvaluationReportSchema.shape.recommendations,
  referenceReply:
    scenarioEvaluationReportSchema.shape.referenceReply,
  reviewTrigger: z
    .enum(["failed", "critical_risk", "low_confidence", "random_sample"])
    .nullable(),
  transcript: z.array(
    z.object({
      role: z.enum(["customer", "learner"]),
      content: z.string(),
      createdAt: z.string().datetime(),
    }),
  ),
  createdAt: z.string().datetime(),
  decision: reviewDecisionInputSchema.optional(),
});

export type ReviewDecisionInput = z.infer<
  typeof reviewDecisionInputSchema
>;
export type TrainingReviewItem = z.infer<
  typeof trainingReviewItemSchema
>;
