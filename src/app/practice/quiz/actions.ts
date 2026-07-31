"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/guards";
import { evaluateAnswer } from "@/lib/quiz/attempt";
import { saveQuizAttemptForLearner } from "@/lib/quiz/attempt-service";
import { demoQuizQuestions } from "@/lib/quiz/demo-questions";
import { topicQuizQuestions } from "@/lib/quiz/question-bank";
import { loadPublishedQuiz } from "@/lib/quiz/review-service";
import type { QuizQuestion } from "@/lib/quiz/schema";
import { createTopicQuizHash } from "@/lib/quiz/topic-hash";

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

export async function checkDemoQuizAnswerAction(
  questionId: string,
  selected: string,
): Promise<QuizAnswerFeedback> {
  await requireUser();
  return checkAnswer(demoQuizQuestions, questionId, selected);
}

export async function checkPublishedQuizAnswerAction(
  quizHash: string,
  questionId: string,
  selected: string,
): Promise<QuizAnswerFeedback> {
  await requireUser();
  const publishedQuiz = await loadPublishedQuiz();
  if (!publishedQuiz || publishedQuiz.quizHash !== quizHash) {
    throw new Error("当前正式题组已更新，请重新开始练习。");
  }
  return checkAnswer(publishedQuiz.questions, questionId, selected);
}

export async function checkTopicQuizAnswerAction(
  topicId: string,
  questionId: string,
  selected: string,
): Promise<QuizAnswerFeedback> {
  await requireUser();
  const topic = z.string().trim().min(1).parse(topicId);
  return checkAnswer(
    topicQuizQuestions.filter((question) => question.category === topic),
    questionId,
    selected,
  );
}

export async function saveQuizAttemptAction(
  quizHash: string,
  assignmentIdInput: string | undefined,
  attemptIdInput: string,
  submittedAnswers: QuizAnswerSubmission[],
): Promise<void> {
  const user = await requireUser();
  const attemptId = z.string().uuid().parse(attemptIdInput);
  const assignmentId = assignmentIdInput
    ? z.string().uuid().parse(assignmentIdInput)
    : undefined;
  const answers = submittedAnswersSchema.parse(submittedAnswers);
  const publishedQuiz = await loadPublishedQuiz();

  if (!publishedQuiz || publishedQuiz.quizHash !== quizHash) {
    throw new Error("当前正式题组已更新，请重新开始练习。");
  }

  const questionsById = new Map(
    publishedQuiz.questions.map((question) => [question.id, question]),
  );
  const checkedAnswers = answers.map((answer) => {
    const question = questionsById.get(answer.questionId);
    if (!question) {
      throw new Error("题目不属于当前已发布题组。");
    }
    return {
      questionId: answer.questionId,
      selectedAnswers: [answer.selected],
      isCorrect: evaluateAnswer(
        [answer.selected],
        question.correctAnswers,
      ),
    };
  });
  await saveQuizAttemptForLearner({
    attemptId,
    learnerId: user.id,
    quizHash,
    assignmentId,
    passingScore: publishedQuiz.passingScore,
    answers: checkedAnswers,
  });
  revalidatePath("/practice/history");
}

export async function saveTopicQuizAttemptAction(
  topicId: string,
  attemptIdInput: string,
  submittedAnswers: QuizAnswerSubmission[],
): Promise<void> {
  const user = await requireUser();
  const topic = z.string().trim().min(1).parse(topicId);
  const attemptId = z.string().uuid().parse(attemptIdInput);
  const answers = submittedAnswersSchema.parse(submittedAnswers);

  const questionsById = new Map(
    topicQuizQuestions.map((question) => [question.id, question]),
  );
  const checkedAnswers = answers.map((answer) => {
    const question = questionsById.get(answer.questionId);
    if (!question) {
      throw new Error("题目不属于当前专题题库。");
    }
    return {
      questionId: answer.questionId,
      selectedAnswers: [answer.selected],
      isCorrect: evaluateAnswer([answer.selected], question.correctAnswers),
    };
  });

  await saveQuizAttemptForLearner({
    attemptId,
    learnerId: user.id,
    quizHash: createTopicQuizHash(topic),
    topicId: topic,
    passingScore: 80,
    answers: checkedAnswers,
  });
  revalidatePath("/practice/history");
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
