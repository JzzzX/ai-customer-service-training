"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/guards";
import { evaluateAnswer } from "@/lib/quiz/attempt";
import { saveQuizAttemptForLearner } from "@/lib/quiz/attempt-service";
import { loadPublishedQuiz } from "@/lib/quiz/review-service";

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

export async function saveQuizAttemptAction(
  quizHash: string,
  attemptIdInput: string,
  submittedAnswers: QuizAnswerSubmission[],
): Promise<void> {
  const user = await requireUser();
  const attemptId = z.string().uuid().parse(attemptIdInput);
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
    passingScore: publishedQuiz.passingScore,
    answers: checkedAnswers,
  });
  revalidatePath("/practice/history");
}
