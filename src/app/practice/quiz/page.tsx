import Link from "next/link";

import { QuizRunner } from "@/components/quiz/quiz-runner";
import { requireUser } from "@/lib/auth/guards";
import { demoQuizQuestions } from "@/lib/quiz/demo-questions";
import { loadPublishedQuiz } from "@/lib/quiz/review-service";
import { selectQuestionGroup } from "@/lib/quiz/select-question-group";

import { saveQuizAttemptAction } from "./actions";

export default async function PracticeQuizPage() {
  await requireUser();
  const publishedQuiz = await loadPublishedQuiz();
  const questions = publishedQuiz
    ? selectQuestionGroup(publishedQuiz.questions)
    : demoQuizQuestions;
  const passingScore = publishedQuiz?.passingScore ?? 80;
  const saveAttempt = publishedQuiz
    ? saveQuizAttemptAction.bind(null, publishedQuiz.quizHash)
    : undefined;

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-start justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-[#399a57]">知识小测</p>
              <span className="rounded-full bg-[#fff1da] px-3 py-1 text-xs font-bold text-[#9a641f]">
                {publishedQuiz ? "正式题组" : "交互演示题"}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-black text-[#21312a]">
              知识小测
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#68786f]">
              {publishedQuiz
                ? `本组从已审核的${publishedQuiz.questions.length}道题中选取${questions.length}道，完成后可重练错题。`
                : "正式40题仍在管理员审核；这里先验证完整答题体验，不作为培训成绩。"}
            </p>
          </div>
          <Link
            className="shrink-0 font-bold text-[#65756d]"
            href="/practice"
          >
            返回
          </Link>
        </header>

        <div className="mt-8">
          <QuizRunner
            onComplete={saveAttempt}
            passingScore={passingScore}
            questions={questions}
          />
        </div>
      </div>
    </main>
  );
}
