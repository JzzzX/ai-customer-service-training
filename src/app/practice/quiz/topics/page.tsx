import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { SoftCard } from "@/components/ui/soft-card";
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
        <PageHeader
          backHref="/practice"
          description="5 个专题 · 230+ 道题 · 每次随机抽 10 题，完成后可重练错题。"
          label="知识小测"
          title="选择专题"
        />

        <section className="mt-10 grid gap-5 sm:grid-cols-2 animate-fade-in-up stagger-1">
          {quizTopics.map((topic) => {
            const count = topicCounts.get(topic.id) ?? 0;
            return (
              <Link
                className="group"
                href={`/practice/quiz?topic=${encodeURIComponent(topic.id)}`}
                key={topic.id}
              >
                <SoftCard className="h-full" gradient hover>
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
                  <p className="mt-4 text-sm leading-6 text-ink-soft">
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
                </SoftCard>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}
