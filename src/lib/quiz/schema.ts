import { z } from "zod";

import { sourceLocatorSchema } from "@/lib/knowledge/schema";

export const quizQuestionTypeSchema = z.enum([
  "single_choice",
  "true_false",
]);

export const quizQuestionDraftSchema = z.object({
  id: z.string().regex(/^qq_[a-f0-9]{24}$/),
  knowledgeUnitId: z.string().regex(/^ku_[a-f0-9]{24}$/),
  type: quizQuestionTypeSchema,
  prompt: z.string().trim().min(1),
  options: z.array(z.string().trim().min(1)).min(2),
  correctAnswers: z.array(z.string().trim().min(1)).length(1),
  explanation: z.string().trim().min(1),
  category: z.string().trim().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
  status: z.literal("draft"),
  sources: z.array(sourceLocatorSchema).min(1),
});

export const quizDraftPackSchema = z.object({
  schemaVersion: z.literal(1),
  quizHash: z.string().regex(/^[a-f0-9]{64}$/),
  knowledgePackHash: z.string().regex(/^[a-f0-9]{64}$/),
  title: z.string().trim().min(1),
  passingScore: z.number().int().min(0).max(100),
  status: z.literal("draft"),
  questions: z.array(quizQuestionDraftSchema).min(1),
});

export type QuizQuestionDraft = z.infer<typeof quizQuestionDraftSchema>;
export type QuizDraftPack = z.infer<typeof quizDraftPackSchema>;
