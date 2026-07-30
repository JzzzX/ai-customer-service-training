import Link from "next/link";

import { SignOutButton } from "@/components/sign-out-button";
import { requireUser } from "@/lib/auth/guards";

export default async function PracticePage() {
  const user = await requireUser();

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-brand">训练中心</p>
            <h1 className="mt-1 text-2xl font-black text-ink">
              你好，{user.name}
            </h1>
          </div>
          <SignOutButton />
        </header>

        <section className="mt-12 grid gap-5 md:grid-cols-3">
          <article className="rounded-[var(--radius-card)] border-2 border-brand-border bg-surface p-7 shadow-[var(--shadow-card)]">
            <p className="text-sm font-bold text-ink-faint">管理员下发</p>
            <h2 className="mt-2 text-2xl font-black text-ink">我的任务</h2>
            <p className="mt-3 leading-7 text-ink-soft">
              集中查看待完成、进行中和已完成的正式训练。
            </p>
            <Link
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl border-2 border-brand-border bg-brand-soft px-5 font-black text-brand-ink transition-transform active:translate-y-1 active:shadow-none"
              href="/practice/assignments"
            >
              查看任务
            </Link>
          </article>

          <article className="rounded-[var(--radius-card)] border-2 border-brand-border bg-surface p-7 shadow-[var(--shadow-card)]">
            <p className="text-sm font-bold text-brand">5 个专题 · 230+ 道题</p>
            <h2 className="mt-2 text-2xl font-black text-ink">知识小测</h2>
            <p className="mt-3 leading-7 text-ink-soft">
              按专题分类练习，每次随机抽 10 题，完成后可重练错题。
            </p>
            <Link
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-brand px-5 font-black text-white shadow-[var(--shadow-btn)] transition-transform active:translate-y-1 active:shadow-none"
              href="/practice/quiz/topics"
            >
              选择专题
            </Link>
          </article>

          <article className="rounded-[var(--radius-card)] border-2 border-brand-border bg-surface p-7 shadow-[var(--shadow-card)]">
            <p className="text-sm font-bold text-ink-faint">
              演示模式 · 约5分钟
            </p>
            <h2 className="mt-2 text-2xl font-black text-ink">情景实战</h2>
            <p className="mt-3 leading-7 text-ink-soft">
              在模拟顾客对话中练习售前、物流、破损和客诉处理。
            </p>
            <Link
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl border-2 border-brand-border bg-brand-soft px-5 font-black text-brand-ink transition-transform active:translate-y-1 active:shadow-none"
              href="/practice/scenario"
            >
              开始实战
            </Link>
          </article>
        </section>

        {user.role === "admin" ? (
          <div className="mt-8 flex flex-wrap gap-5">
            <Link
              className="font-bold text-brand-ink"
              href="/practice/history"
            >
              查看练习记录
            </Link>
            <Link className="font-bold text-admin" href="/admin">
              进入管理端
            </Link>
          </div>
        ) : (
          <Link
            className="mt-8 inline-flex font-bold text-brand-ink"
            href="/practice/history"
          >
            查看练习记录
          </Link>
        )}
      </div>
    </main>
  );
}
