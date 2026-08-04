import { z } from "zod";

const questionIdSchema = z.string().regex(/^qq_[a-f0-9]{24}$/);

export const quizAttemptRecordSchema = z.object({
  id: z.string().uuid(),
  learnerId: z.string().uuid(),
  quizHash: z.string().regex(/^[a-f0-9]{64}$/),
  assignmentId: z.string().uuid().optional(),
  topicId: z.string().trim().min(1).optional(),
  status: z.enum(["passed", "needs_retry"]),
  correctCount: z.number().int().min(0),
  totalQuestions: z.number().int().positive(),
  score: z.number().int().min(0).max(100),
  missedQuestionIds: z.array(questionIdSchema),
  /**
   * Older local records did not persist correct question IDs. Keep this
   * optional so they remain readable while new records can calculate exact
   * de-duplicated coverage.
   */
  answeredQuestionIds: z.array(questionIdSchema).optional(),
  completedAt: z.string().datetime(),
});

export type QuizAttemptRecord = z.infer<typeof quizAttemptRecordSchema>;

export const saveQuizAttemptInputSchema = z.object({
  attemptId: z.string().uuid(),
  learnerId: z.string().uuid(),
  quizHash: z.string().regex(/^[a-f0-9]{64}$/),
  assignmentId: z.string().uuid().optional(),
  topicId: z.string().trim().min(1).optional(),
  passingScore: z.number().int().min(0).max(100),
  answers: z
    .array(
      z.object({
        questionId: questionIdSchema,
        selectedAnswers: z.array(z.string().trim().min(1)).min(1),
        isCorrect: z.boolean(),
      }),
    )
    .min(1)
    .refine(
      (answers) =>
        new Set(answers.map((answer) => answer.questionId)).size ===
        answers.length,
      "同一道题不能重复提交。",
    ),
  completedAt: z.string().datetime().optional(),
});

export type SaveQuizAttemptInput = z.infer<
  typeof saveQuizAttemptInputSchema
>;

export interface QuizAttemptStore {
  saveAttempt(input: SaveQuizAttemptInput): Promise<QuizAttemptRecord>;
  listAttempts(learnerId: string): Promise<QuizAttemptRecord[]>;
}
