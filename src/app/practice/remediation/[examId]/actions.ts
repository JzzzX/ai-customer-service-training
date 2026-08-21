"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireLearner } from "@/lib/auth/guards";
import { evaluateAnswer } from "@/lib/quiz/attempt";
import { loadQuizAttemptSnapshotForLearner, saveQuizAttemptForLearner } from "@/lib/quiz/attempt-service";
import { loadRemediationExam } from "@/lib/remediation/service";
import type { QuizAnswerFeedback, QuizAnswerSubmission, QuizCompletionProgress } from "@/app/practice/quiz/actions";

export async function checkRemediationAnswerAction(examId: string, questionId: string, selected: string): Promise<QuizAnswerFeedback> {
  const learner = await requireLearner();
  const exam = loadRemediationExam(learner.id, examId);
  const snapshot = await loadQuizAttemptSnapshotForLearner(learner.id, exam.attemptId);
  if (snapshot.kind !== "remediation") throw new Error("小测类型不匹配，请重新进入改善考卷。");
  const question = snapshot.questions.find((item) => item.id === questionId);
  if (!question || !question.options.includes(selected)) throw new Error("题目或选项无效，请刷新后重试。");
  const source = question.sources[0];
  return { isCorrect: evaluateAnswer([selected], question.correctAnswers), explanation: question.explanation, sourceLabel: source ? `${source.sourcePath} · ${source.anchor}` : "未标注" };
}

export async function saveRemediationExamAction(examId: string, attemptIdInput: string, submitted: QuizAnswerSubmission[]): Promise<QuizCompletionProgress> {
  const learner = await requireLearner();
  const exam = loadRemediationExam(learner.id, examId);
  const attemptId = z.string().uuid().parse(attemptIdInput);
  if (exam.attemptId !== attemptId) throw new Error("改善考卷记录不匹配。");
  const savedAttempt = await saveQuizAttemptForLearner({ attemptId, learnerId: learner.id, quizHash: exam.quizHash, passingScore: 80,
    answers: submitted.map((answer) => ({ questionId: answer.questionId, selectedAnswers: [answer.selected], isCorrect: false })) });
  revalidatePath("/practice/report"); revalidatePath(`/practice/remediation/${examId}`);
  return { savedAttempt, newCoverageCount: 0 };
}
