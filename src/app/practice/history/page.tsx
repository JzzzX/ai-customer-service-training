import Link from "next/link";

import { requireUser } from "@/lib/auth/guards";
import { listQuizAttemptsForLearner } from "@/lib/quiz/attempt-service";

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Shanghai",
});

export default async function PracticeHistoryPage() {
  const user = await requireUser();
  const attempts = await listQuizAttemptsForLearner(user.id);

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-start justify-between gap-5">
          <div>
            <p className="text-sm font-bold text-[#399a57]">训练中心</p>
            <h1 className="mt-2 text-2xl font-black text-[#21312a]">
              练习记录
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#68786f]">
              这里只显示当前账号完成的正式知识小测。
            </p>
          </div>
          <Link
            className="shrink-0 font-bold text-[#65756d]"
            href="/practice"
          >
            返回
          </Link>
        </header>

        {attempts.length === 0 ? (
          <section className="mt-8 rounded-[28px] border-2 border-[#dce8df] bg-white p-8 text-center">
            <h2 className="text-xl font-black text-[#21312a]">
              还没有正式练习记录
            </h2>
            <p className="mt-2 text-sm text-[#68786f]">
              管理员发布题组后，完成小测的结果会保存在这里。
            </p>
          </section>
        ) : (
          <section className="mt-8 grid gap-4">
            {attempts.map((attempt) => (
              <article
                className="flex flex-wrap items-center justify-between gap-5 rounded-[24px] border-2 border-[#dce8df] bg-white p-6"
                key={attempt.id}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-black text-[#21312a]">知识小测</h2>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        attempt.status === "passed"
                          ? "bg-[#eaf7ed] text-[#2f7b46]"
                          : "bg-[#fff1e5] text-[#b56127]"
                      }`}
                    >
                      {attempt.status === "passed"
                        ? "已通过"
                        : "需要重练"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[#68786f]">
                    {dateTimeFormatter.format(
                      new Date(attempt.completedAt),
                    )}
                  </p>
                  <p className="mt-3 font-bold text-[#405149]">
                    <span>
                      答对 {attempt.correctCount} / {attempt.totalQuestions} 题
                    </span>
                    <span
                      aria-hidden="true"
                      className="mx-2 text-[#a5b0aa]"
                    >
                      ·
                    </span>
                    <span>{attempt.missedQuestionIds.length} 道错题</span>
                  </p>
                </div>
                <p className="text-4xl font-black text-[#399a57]">
                  {attempt.score}%
                </p>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
