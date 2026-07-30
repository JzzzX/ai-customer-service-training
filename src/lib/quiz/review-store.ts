import type { QuizReview } from "./review";
import type {
  QuizPublishedPack,
  QuizQuestionDraft,
} from "./schema";

export type QuizQuestionChanges = {
  prompt?: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  category?: string;
  difficulty?: QuizQuestionDraft["difficulty"];
};

export type ApproveStoredQuestionInput = {
  questionId: string;
  reviewerId: string;
  changes?: QuizQuestionChanges;
};

export interface QuizReviewStore {
  loadReview(): Promise<QuizReview>;
  approveQuestion(input: ApproveStoredQuestionInput): Promise<QuizReview>;
  publish(): Promise<QuizPublishedPack>;
  loadPublished(): Promise<QuizPublishedPack | null>;
}
