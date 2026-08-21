import type { BeijingDateRange } from "@/lib/report/learning-quiz-report";

export type RemediationExamStatus = "in_progress" | "completed";
export interface RemediationTargetCategory { category: string; questionCount: number }
export interface RemediationCategoryResult extends RemediationTargetCategory { correctCount: number; accuracy: number; passed: boolean }
export interface RemediationImprovementResult { totalScore: number; overallPassed: boolean; categories: RemediationCategoryResult[]; improved: boolean }
export interface RemediationExamQuestion { stableKey: string; revisionId: string; category: string }
export interface RemediationExam {
  id: string; learnerId: string; quizSetId: string; attemptId: string; quizHash: string;
  weaknessFingerprint: string; reportRange: BeijingDateRange; reportDataCutoffAt: string;
  status: RemediationExamStatus; targets: RemediationTargetCategory[]; questions: RemediationExamQuestion[];
  createdAt: string; completedAt: string | null; result: RemediationImprovementResult | null;
}
export type GenerateRemediationExamResult =
  | { status: "created" | "existing"; exam: RemediationExam }
  | { status: "no_weakness" }
  | { status: "insufficient_bank"; category: string; required: number; available: number };
