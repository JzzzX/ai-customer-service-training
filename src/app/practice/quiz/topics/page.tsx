import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress-bar";
import { SoftCard } from "@/components/ui/soft-card";
import { requireUser } from "@/lib/auth/guards";
import { getQuizProgressForLearner } from "@/lib/quiz/attempt-service";
import { quizTopics, topicQuizQuestions } from "@/lib/quiz/question-bank";

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Shanghai",
});

export default async function QuizTopicsPage() {
  const user = await requireUser();
  const progress = await getQuizProgressForLearner(user.id, { recentLimit: 1 });

  const topicCounts = new Map<string, number>();
  for (const question of topicQuizQuestions) {
    topicCounts.set(
      question.category,
      (topicCounts.get(question.category) ?? 0) + 1,
    );
  }
  const totalTopicQuestions = [...topicCounts.values()].reduce(
    (total, count) => total + count,
    0,
  );
  const topicProgressById = new Map(
    progress.topics.map((topic) => [topic.topicId, topic]),
  );
  const latestAttempt = progress.recentAttempts[0];
  const latestTopicLabel = latestAttempt?.topicId
    ? quizTopics.find((topic) => topic.id === latestAttempt.topicId)?.label ??
      "专题练习"
    : "正式题组";

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          backHref="/practice"
          description={`5 个专题 · ${totalTopicQuestions} 道题 · 每次随机抽 10 题，完成后可重练错题。`}
          label="知识小测"
          title="选择专题"
        />

        <SoftCard className="mt-7" gradient>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-ink-faint">总体覆盖</p>
              <p className="mt-2 text-2xl font-black text-ink">
                {progress.uniqueAnsweredCount} / {progress.totalQuestions} 题
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                累计正确率 {progress.accuracy}% · 已完成 {progress.attemptCount} 次测验
              </p>
            </div>
            <Link
              className="font-bold text-brand hover:underline"
              href="/practice/profile?tab=quiz"
            >
              查看详细记录
              <span aria-hidden="true" className="ml-1">→</span>
            </Link>
          </div>
          <ProgressBar
            className="mt-4"
            value={progress.uniqueAnsweredCount}
            max={Math.max(progress.totalQuestions, 1)}
          />
          <p className="mt-3 text-xs text-ink-soft">
            {latestAttempt
              ? `最近一次：${latestTopicLabel} · ${dateTimeFormatter.format(new Date(latestAttempt.completedAt))} · 得分 ${latestAttempt.score}%`
              : "最近一次：还没有练习记录"}
          </p>
        </SoftCard>

        <section className="mt-10 grid gap-5 sm:grid-cols-2 animate-fade-in-up stagger-1">
          {quizTopics.map((topic) => {
            const count = topicCounts.get(topic.id) ?? 0;
            const topicProgress = topicProgressById.get(topic.id);
            const coveredCount = topicProgress?.uniqueAnsweredCount ?? 0;
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
                  <p className="mt-4 text-sm font-bold text-ink-soft">
                    {coveredCount > 0
                      ? `已覆盖 ${coveredCount} / ${count} 题 · 正确率 ${topicProgress?.accuracy ?? 0}%`
                      : `已覆盖 0 / ${count} 题 · 还未开始`}
                  </p>
                  <ProgressBar
                    className="mt-3"
                    value={coveredCount}
                    max={Math.max(count, 1)}
                  />
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
