import Link from "next/link";

import { requireUser } from "@/lib/auth/guards";
import { quizTopics, topicQuizQuestions } from "@/lib/quiz/question-bank";

export default async function QuizTopicsPage() {
  await requireUser();

  const topicCounts = new Map<string, number>();
  for (const question of topicQuizQuestions) {
    topicCounts.set(
      question.category,
      (topicCounts.get(question.category) ?? 0) + 1,
    );
  }

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-start justify-between gap-5">
          <div>
            <p className="text-sm font-bold text-brand">知识小测</p>
            <h1 className="mt-2 text-2xl font-black text-ink">选择专题</h1>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              5 个专题 · 230+ 道题 · 每次随机抽 10 题，完成后可重练错题。
            </p>
          </div>
          <Link
            className="shrink-0 font-bold text-brand-ink"
            href="/practice"
          >
            返回
          </Link>
        </header>

        <section className="mt-8 grid gap-5 sm:grid-cols-2">
          {quizTopics.map((topic) => {
            const count = topicCounts.get(topic.id) ?? 0;
            return (
              <Link
                className="group flex flex-col rounded-[var(--radius-card)] border-2 border-brand-border bg-surface p-7 shadow-[var(--shadow-card)] transition-transform hover:-translate-y-1 active:translate-y-0"
                href={`/practice/quiz?topic=${encodeURIComponent(topic.id)}`}
                key={topic.id}
              >
                <div className="flex items-center gap-4">
                  <span
                    aria-hidden="true"
                    className="flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-3xl"
                  >
                    {topic.icon}
                  </span>
                  <div className="flex-1">
                    <h2 className="text-xl font-black text-ink">
                      {topic.label}
                    </h2>
                    <p className="mt-1 text-xs text-ink-faint">
                      {count} 题 · 简单 / 中等 / 困难
                    </p>
                  </div>
                </div>
                <p className="mt-4 leading-6 text-sm text-ink-soft">
                  {topic.description}
                </p>
                <p className="mt-5 inline-flex items-center gap-1 font-bold text-brand">
                  开始练习
                  <span
                    aria-hidden="true"
                    className="transition-transform group-hover:translate-x-1"
                  >
                    →
                  </span>
                </p>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}
