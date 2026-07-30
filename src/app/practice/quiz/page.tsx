import { randomUUID } from "node:crypto";

import Link from "next/link";

import { QuizRunner } from "@/components/quiz/quiz-runner";
import { requireUser } from "@/lib/auth/guards";
import { demoQuizQuestions } from "@/lib/quiz/demo-questions";
import { quizTopics, topicQuizQuestions } from "@/lib/quiz/question-bank";
import { loadPublishedQuiz } from "@/lib/quiz/review-service";
import {
  selectQuestionGroup,
  selectQuestionGroupByTopic,
} from "@/lib/quiz/select-question-group";

import { saveQuizAttemptAction, saveTopicQuizAttemptAction } from "./actions";

export default async function PracticeQuizPage({
  searchParams,
}: {
  searchParams?: Promise<{ assignment?: string; topic?: string }>;
} = {}) {
  await requireUser();
  const params = await searchParams;
  const assignmentInput = params?.assignment;
  const assignmentId =
    assignmentInput &&
    /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(assignmentInput)
      ? assignmentInput
      : undefined;
  const topicInput = params?.topic;
  const topicMatch = topicInput
    ? quizTopics.find((topic) => topic.id === topicInput)
    : undefined;
  const attemptId = randomUUID();

  if (topicMatch) {
    const topicTotal = topicQuizQuestions.filter(
      (question) => question.category === topicMatch.id,
    ).length;
    const questions = selectQuestionGroupByTopic(
      topicQuizQuestions,
      topicMatch.id,
    );
    const saveAttempt = saveTopicQuizAttemptAction.bind(null, topicMatch.id);

    return (
      <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-3xl">
          <header className="flex items-start justify-between gap-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold text-brand">知识小测</p>
                <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand-ink">
                  专题练习
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-black text-ink">
                {topicMatch.icon} {topicMatch.label}
              </h1>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                {`从该专题 ${topicTotal} 道题中随机抽取 ${questions.length} 题，完成后可重练错题。`}
              </p>
            </div>
            <Link
              className="shrink-0 font-bold text-brand-ink"
              href="/practice/quiz/topics"
            >
              返回
            </Link>
          </header>

          <div className="mt-8">
            <QuizRunner
              attemptId={attemptId}
              onComplete={saveAttempt}
              passingScore={80}
              questions={questions}
            />
          </div>
        </div>
      </main>
    );
  }

  const publishedQuiz = await loadPublishedQuiz();
  const questions = publishedQuiz
    ? selectQuestionGroup(publishedQuiz.questions)
    : demoQuizQuestions;
  const passingScore = publishedQuiz?.passingScore ?? 80;
  const saveAttempt = publishedQuiz
    ? saveQuizAttemptAction.bind(null, publishedQuiz.quizHash, assignmentId)
    : undefined;

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-start justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-brand">知识小测</p>
              <span className="rounded-full bg-[#fff1da] px-3 py-1 text-xs font-bold text-[#9a641f]">
                {publishedQuiz ? "正式题组" : "交互演示题"}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-black text-ink">知识小测</h1>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              {publishedQuiz
                ? `本组从已审核的${publishedQuiz.questions.length}道题中选取${questions.length}道，完成后可重练错题。`
                : "正式题组仍在管理员审核；这里先验证完整答题体验，不作为培训成绩。"}
            </p>
          </div>
          <Link
            className="shrink-0 font-bold text-brand-ink"
            href="/practice"
          >
            返回
          </Link>
        </header>

        <div className="mt-8">
          <QuizRunner
            attemptId={attemptId}
            onComplete={saveAttempt}
            passingScore={passingScore}
            questions={questions}
          />
        </div>
      </div>
    </main>
  );
}
