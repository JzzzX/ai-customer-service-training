import Link from "next/link";

import { QuizRunner } from "@/components/quiz/quiz-runner";
import { requireUser } from "@/lib/auth/guards";
import { demoQuizQuestions } from "@/lib/quiz/demo-questions";

export default async function PracticeQuizPage() {
  await requireUser();

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-start justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-[#399a57]">知识小测</p>
              <span className="rounded-full bg-[#fff1da] px-3 py-1 text-xs font-bold text-[#9a641f]">
                交互演示题
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-black text-[#21312a]">
              知识小测
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#68786f]">
              正式40题仍在管理员审核；这里先验证完整答题体验，不作为培训成绩。
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
          <QuizRunner passingScore={80} questions={demoQuizQuestions} />
        </div>
      </div>
    </main>
  );
}
