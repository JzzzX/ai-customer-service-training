import { z } from "zod";

import { sourceLocatorSchema } from "@/lib/knowledge/schema";

export const scenarioCategorySchema = z.enum([
  "presale",
  "logistics",
  "damage_shortage",
  "complaint",
]);

export const customerPersonaSchema = z.object({
  temperament: z.enum(["calm", "anxious", "irritable", "bargain_hunting"]),
  knowledgeLevel: z.enum(["low", "medium", "high"]),
  mood: z.string().trim().min(1),
});

export const difficultySchema = z.enum(["easy", "medium", "hard"]);

export const scenarioTemplateSchema = z.object({
  id: z.string().regex(/^st_[a-f0-9]{24}$/),
  versionId: z.string().regex(/^sv_[a-f0-9]{24}$/),
  title: z.string().trim().min(1),
  category: scenarioCategorySchema,
  summary: z.string().trim().min(1),
  openingMessage: z.string().trim().min(1),
  hiddenFacts: z.array(z.string().trim().min(1)).min(3),
  customerTurns: z.array(z.string().trim().min(1)).min(3),
  scoringDimensions: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        weight: z.number().int().positive(),
        signals: z.array(z.string().trim().min(1)).min(2),
      }),
    )
    .length(5)
    .refine(
      (dimensions) =>
        dimensions.reduce(
          (total, dimension) => total + dimension.weight,
          0,
        ) === 100,
      "评分维度权重之和必须为100。",
    ),
  criticalRisks: z
    .array(
      z.object({
        label: z.string().trim().min(1),
        patterns: z.array(z.string().trim().min(1)).min(1),
      }),
    )
    .min(2),
  referenceFlow: z.array(z.string().trim().min(1)).min(4),
  referenceReply: z.string().trim().min(1),
  sources: z.array(sourceLocatorSchema).min(1),
  maxTurns: z.number().int().min(8).max(16),
  status: z.literal("published"),
  mockMode: z.boolean(),
  customerPersona: customerPersonaSchema.optional(),
  difficulty: difficultySchema.default("medium"),
  scenarioFocus: z.string().trim().min(1).optional(),
});

export const scenarioTemplatesSchema = z
  .array(scenarioTemplateSchema)
  .min(1);

export const scenarioMessageInputSchema = z.object({
  role: z.enum(["customer", "learner"]),
  content: z.string().trim().min(1),
});

export const scenarioRecommendationSchema = z.object({
  issue: z.string().trim().min(1),
  suggestedReply: z.string().trim().min(1),
});

export const scenarioEvaluationReportSchema = z.object({
  mode: z.enum(["mock", "real"]),
  totalScore: z.number().int().min(0).max(100),
  status: z.enum(["passed", "needs_retry"]),
  confidence: z.number().min(0).max(1),
  dimensions: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        score: z.number().int().min(0),
        maxScore: z.number().int().positive(),
        evidence: z.array(z.string().trim().min(1)),
      }),
    )
    .length(5),
  strengths: z.array(z.string().trim().min(1)),
  missedSteps: z.array(z.string().trim().min(1)),
  risks: z.array(z.string().trim().min(1)),
  recommendations: z.array(scenarioRecommendationSchema),
  referenceReply: z.string().trim().min(1),
  lowConfidence: z.boolean().default(false),
});

export const scenarioSessionSchema = z
  .object({
    id: z.string().uuid(),
    learnerId: z.string().uuid(),
    scenarioId: z.string().regex(/^st_[a-f0-9]{24}$/),
    scenarioVersionId: z.string().regex(/^sv_[a-f0-9]{24}$/),
    status: z.enum(["active", "completed"]),
    mode: z.enum(["mock", "real"]),
    learnerTurnCount: z.number().int().min(0),
    maxTurns: z.number().int().min(8).max(16),
    messages: z
      .array(
        z.object({
          id: z.string().uuid(),
          role: z.enum(["customer", "learner"]),
          content: z.string().trim().min(1),
          createdAt: z.string().datetime(),
        }),
      )
      .min(1),
    report: scenarioEvaluationReportSchema.optional(),
    startedAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    completedAt: z.string().datetime().optional(),
  })
  .superRefine((session, context) => {
    if (
      session.status === "completed" &&
      (!session.report || !session.completedAt)
    ) {
      context.addIssue({
        code: "custom",
        message: "已完成会话必须包含报告和完成时间。",
      });
    }
    if (
      session.status === "active" &&
      (session.report || session.completedAt)
    ) {
      context.addIssue({
        code: "custom",
        message: "进行中会话不能提前包含报告。",
      });
    }
  });

export type ScenarioCategory = z.infer<typeof scenarioCategorySchema>;
export type ScenarioMode = "mock" | "real";
export type CustomerPersona = z.infer<typeof customerPersonaSchema>;
export type Difficulty = z.infer<typeof difficultySchema>;
export type ScenarioTemplate = z.infer<typeof scenarioTemplateSchema>;
export type ScenarioMessageInput = z.infer<
  typeof scenarioMessageInputSchema
>;
export type ScenarioRecommendation = z.infer<
  typeof scenarioRecommendationSchema
>;
export type ScenarioEvaluationReport = z.infer<
  typeof scenarioEvaluationReportSchema
>;
export type ScenarioSession = z.infer<typeof scenarioSessionSchema>;
