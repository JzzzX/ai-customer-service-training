"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/guards";
import { evaluateAnswer } from "@/lib/quiz/attempt";
import {
  getQuizProgressForLearner,
  loadQuizAttemptSnapshotForLearner,
  saveQuizAttemptForLearner,
} from "@/lib/quiz/attempt-service";
import { demoQuizQuestions } from "@/lib/quiz/demo-questions";
import type { QuizAttemptRecord } from "@/lib/quiz/attempt-store";
import type { QuizTopicProgress } from "@/lib/quiz/progress";
import type { QuizQuestion } from "@/lib/quiz/schema";

const submittedAnswerSchema = z.object({
  questionId: z.string().regex(/^qq_[a-f0-9]{24}$/),
  selected: z.string().trim().min(1),
});

const submittedAnswersSchema = z
  .array(submittedAnswerSchema)
  .min(1)
  .max(10)
  .refine(
    (answers) =>
      new Set(answers.map((answer) => answer.questionId)).size ===
      answers.length,
    "同一道题不能重复提交。",
  );

export type QuizAnswerSubmission = z.infer<typeof submittedAnswerSchema>;

export type QuizAnswerFeedback = {
  isCorrect: boolean;
  explanation: string;
  sourceLabel: string;
};

export type QuizCompletionProgress = {
  savedAttempt: QuizAttemptRecord;
  newCoverageCount: number;
  topicProgress?: QuizTopicProgress;
};

export async function checkDemoQuizAnswerAction(
  questionId: string,
  selected: string,
): Promise<QuizAnswerFeedback> {
  await requireUser();
  return checkAnswer(demoQuizQuestions, questionId, selected);
}

export async function checkPublishedQuizAnswerAction(
  attemptIdInput: string,
  questionId: string,
  selected: string,
): Promise<QuizAnswerFeedback> {
  const user = await requireUser();
  const attemptId = z.string().uuid().parse(attemptIdInput);
  const snapshot = await loadQuizAttemptSnapshotForLearner(user.id, attemptId);
  if (snapshot.topicId) throw new Error("小测类型不匹配，请重新开始练习。");
  return checkAnswer(snapshot.questions, questionId, selected);
}

export async function checkTopicQuizAnswerAction(
  attemptIdInput: string,
  questionId: string,
  selected: string,
): Promise<QuizAnswerFeedback> {
  const user = await requireUser();
  const attemptId = z.string().uuid().parse(attemptIdInput);
  const snapshot = await loadQuizAttemptSnapshotForLearner(user.id, attemptId);
  if (!snapshot.topicId) throw new Error("小测类型不匹配，请重新开始练习。");
  return checkAnswer(snapshot.questions, questionId, selected);
}

export async function saveQuizAttemptAction(
  quizHash: string,
  attemptIdInput: string,
  submittedAnswers: QuizAnswerSubmission[],
): Promise<QuizCompletionProgress> {
  const user = await requireUser();
  const attemptId = z.string().uuid().parse(attemptIdInput);
  const answers = submittedAnswersSchema.parse(submittedAnswers);
  const savedAttempt = await saveQuizAttemptForLearner({
    attemptId,
    learnerId: user.id,
    quizHash,
    passingScore: 80,
    answers: toStoreSubmissions(answers),
  });
  revalidatePracticePaths();
  return { savedAttempt, newCoverageCount: 0 };
}

export async function saveTopicQuizAttemptAction(
  topicId: string,
  quizHash: string,
  attemptIdInput: string,
  submittedAnswers: QuizAnswerSubmission[],
): Promise<QuizCompletionProgress> {
  const user = await requireUser();
  const topic = z.string().trim().min(1).parse(topicId);
  const attemptId = z.string().uuid().parse(attemptIdInput);
  const answers = submittedAnswersSchema.parse(submittedAnswers);
  const savedAttempt = await saveQuizAttemptForLearner({
    attemptId,
    learnerId: user.id,
    quizHash,
    topicId: topic,
    passingScore: 80,
    answers: toStoreSubmissions(answers),
  });
  const progress = await getQuizProgressForLearner(user.id);
  const recentAttempt = progress.recentAttempts.find(
    (attempt) => attempt.id === savedAttempt.id,
  );
  const topicProgress = progress.topics.find(
    (topicProgress) => topicProgress.topicId === topic,
  );
  revalidatePracticePaths();
  return {
    savedAttempt,
    newCoverageCount: recentAttempt?.newCoverageCount ?? 0,
    ...(topicProgress ? { topicProgress } : {}),
  };
}

function revalidatePracticePaths(): void {
  revalidatePath("/practice");
  revalidatePath("/practice/quiz/topics");
  revalidatePath("/practice/profile");
  revalidatePath("/practice/history");
}

function toStoreSubmissions(answers: QuizAnswerSubmission[]) {
  return answers.map((answer) => {
    return {
      questionId: answer.questionId,
      selectedAnswers: [answer.selected],
      // The database store intentionally ignores this hint and grades its immutable snapshot.
      isCorrect: false,
    };
  });
}

function checkAnswer(
  questions: QuizQuestion[],
  questionIdInput: string,
  selectedInput: string,
): QuizAnswerFeedback {
  const { questionId, selected } = submittedAnswerSchema.parse({
    questionId: questionIdInput,
    selected: selectedInput,
  });
  const question = questions.find((candidate) => candidate.id === questionId);
  if (!question || !question.options.includes(selected)) {
    throw new Error("题目或选项无效，请刷新后重试。");
  }
  return {
    isCorrect: evaluateAnswer([selected], question.correctAnswers),
    explanation: question.explanation,
    sourceLabel: formatSource(question),
  };
}

function formatSource(question: QuizQuestion): string {
  const source = question.sources[0];
  if (!source) {
    return "未标注";
  }
  if (source.sheet && source.row) {
    return `${source.sourcePath} · ${source.sheet} 第 ${source.row} 行`;
  }
  if (source.line) {
    return `${source.sourcePath} · 第 ${source.line} 行`;
  }
  return `${source.sourcePath} · ${source.anchor}`;
}
