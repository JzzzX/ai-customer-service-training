import Link from "next/link";

import { requireUser } from "@/lib/auth/guards";
import { quizTopics, topicQuizQuestions } from "@/lib/quiz/question-bank";
import { listQuizAttemptsForLearner } from "@/lib/quiz/attempt-service";

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Shanghai",
});

export default async function PracticeHistoryPage() {
  const user = await requireUser();
  const attempts = await listQuizAttemptsForLearner(user.id);

  const topicTotals = new Map<string, number>();
  for (const question of topicQuizQuestions) {
    topicTotals.set(
      question.category,
      (topicTotals.get(question.category) ?? 0) + 1,
    );
  }

  const topicStats = quizTopics.map((topic) => {
    const total = topicTotals.get(topic.id) ?? 0;
    const topicAttempts = attempts.filter(
      (attempt) => attempt.topicId === topic.id,
    );
    const practicedCount = Math.min(
      topicAttempts.reduce(
        (sum, attempt) => sum + attempt.totalQuestions,
        0,
      ),
      total,
    );
    const avgScore =
      topicAttempts.length > 0
        ? Math.round(
            topicAttempts.reduce(
              (sum, attempt) => sum + attempt.score,
              0,
            ) / topicAttempts.length,
          )
        : 0;
    return {
      topic,
      total,
      practicedCount,
      attemptCount: topicAttempts.length,
      avgScore,
    };
  });

  const recentAttempts = attempts.slice(0, 10);

  function attemptLabel(attempt: (typeof attempts)[number]): string {
    if (attempt.topicId) {
      return (
        quizTopics.find((topic) => topic.id === attempt.topicId)?.label ??
        "专题练习"
      );
    }
    return "正式题组";
  }

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-start justify-between gap-5">
          <div>
            <p className="text-sm font-bold text-brand">训练中心</p>
            <h1 className="mt-2 text-2xl font-black text-ink">学习进度</h1>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              5 个专题的练习进度与最近记录。
            </p>
          </div>
          <Link
            className="shrink-0 font-bold text-brand-ink"
            href="/practice"
          >
            返回
          </Link>
        </header>

        <section className="mt-8">
          <h2 className="text-lg font-black text-ink">专题进度</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {topicStats.map(
              ({ topic, total, practicedCount, attemptCount, avgScore }) => {
                const progressPercent =
                  total > 0
                    ? Math.round((practicedCount / total) * 100)
                    : 0;
                return (
                  <article
                    className="rounded-[var(--radius-card)] border-2 border-brand-border bg-surface p-6 shadow-[var(--shadow-card)]"
                    key={topic.id}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex size-10 items-center justify-center rounded-2xl bg-brand-soft text-2xl"
                      >
                        {topic.icon}
                      </span>
                      <div className="flex-1">
                        <h3 className="font-black text-ink">{topic.label}</h3>
                        <p className="text-xs text-ink-faint">
                          {topic.description}
                        </p>
                      </div>
                    </div>
                    <div
                      aria-label={`进度 ${progressPercent}%`}
                      className="mt-4 h-2 overflow-hidden rounded-full bg-brand-soft"
                    >
                      <div
                        className="h-full rounded-full bg-brand transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-ink-soft">
                      {attemptCount > 0
                        ? `已练 ${practicedCount} / ${total} 题 · 平均正确率 ${avgScore}%`
                        : `共 ${total} 题 · 还未开始`}
                    </p>
                  </article>
                );
              },
            )}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-black text-ink">最近练习</h2>
          {recentAttempts.length === 0 ? (
            <div className="mt-4 rounded-[var(--radius-card)] border-2 border-brand-border bg-surface p-8 text-center shadow-[var(--shadow-card)]">
              <p className="font-black text-ink">还没有练习记录</p>
              <p className="mt-2 text-sm text-ink-soft">
                选择一个专题开始第一次练习吧。
              </p>
              <Link
                className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-brand px-5 font-black text-white shadow-[var(--shadow-btn)] transition-transform active:translate-y-1 active:shadow-none"
                href="/practice/quiz/topics"
              >
                选择专题
              </Link>
            </div>
          ) : (
            <ul className="mt-4 grid gap-3">
              {recentAttempts.map((attempt) => (
                <li
                  className="flex items-center justify-between rounded-2xl border-2 border-brand-border bg-surface px-5 py-4 shadow-[var(--shadow-card)]"
                  key={attempt.id}
                >
                  <div>
                    <p className="font-bold text-ink">
                      {attemptLabel(attempt)}
                    </p>
                    <p className="mt-1 text-xs text-ink-soft">
                      {dateTimeFormatter.format(
                        new Date(attempt.completedAt),
                      )}
                    </p>
                  </div>
                  <p className="text-2xl font-black text-brand">
                    {attempt.score}%
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
