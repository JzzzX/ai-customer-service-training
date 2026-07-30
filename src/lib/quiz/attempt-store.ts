import { z } from "zod";

const questionIdSchema = z.string().regex(/^qq_[a-f0-9]{24}$/);

export const quizAttemptRecordSchema = z.object({
  id: z.string().uuid(),
  learnerId: z.string().uuid(),
  quizHash: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.enum(["passed", "needs_retry"]),
  correctCount: z.number().int().min(0),
  totalQuestions: z.number().int().positive(),
  score: z.number().int().min(0).max(100),
  missedQuestionIds: z.array(questionIdSchema),
  completedAt: z.string().datetime(),
});

export type QuizAttemptRecord = z.infer<typeof quizAttemptRecordSchema>;

export type SaveQuizAttemptInput = {
  learnerId: string;
  quizHash: string;
  passingScore: number;
  correctCount: number;
  totalQuestions: number;
  missedQuestionIds: string[];
  completedAt?: string;
};

export interface QuizAttemptStore {
  saveAttempt(input: SaveQuizAttemptInput): Promise<QuizAttemptRecord>;
  listAttempts(learnerId: string): Promise<QuizAttemptRecord[]>;
}
