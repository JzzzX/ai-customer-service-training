import Link from "next/link";

import { SignOutButton } from "@/components/sign-out-button";
import { SoftBadge } from "@/components/ui/soft-badge";
import { SoftCard } from "@/components/ui/soft-card";
import { requireUser } from "@/lib/auth/guards";

const entries = [
  {
    label: "我的任务",
    description: "集中查看待完成、进行中和已完成的正式训练。",
    href: "/practice/assignments",
    action: "查看任务",
    icon: "📋",
    tone: "warm",
  },
  {
    label: "知识小测",
    description: "按专题分类练习，每次随机抽 10 题，完成后可重练错题。",
    href: "/practice/quiz/topics",
    action: "选择专题",
    icon: "📝",
    tone: "brand",
  },
  {
    label: "情景实战",
    description: "在模拟顾客对话中练习售前、物流、破损和客诉处理。",
    href: "/practice/scenario",
    action: "开始实战",
    icon: "💬",
    tone: "scenario",
  },
] as const;

export default async function PracticePage() {
  const user = await requireUser();

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-start justify-between gap-4 animate-fade-in-up">
          <div>
            <SoftBadge variant="muted">训练中心</SoftBadge>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-ink sm:text-4xl">
              你好，{user.name}
            </h1>
            <p className="mt-2 text-ink-soft">
              今天想从哪一项训练开始？
            </p>
          </div>
          <SignOutButton />
        </header>

        <section className="mt-12 grid gap-5 md:grid-cols-3">
          {entries.map((entry) => (
            <SoftCard
              className="animate-fade-in-up flex flex-col"
              gradient
              hover
              key={entry.label}
            >
              <div
                className="flex size-12 items-center justify-center rounded-2xl text-2xl"
                style={{
                  backgroundColor:
                    entry.tone === "warm"
                      ? "var(--color-warm-soft)"
                      : entry.tone === "scenario"
                        ? "var(--color-scenario-soft)"
                        : "var(--color-brand-soft)",
                }}
              >
                {entry.icon}
              </div>
              <h2 className="mt-5 text-xl font-black text-ink">
                {entry.label}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-ink-soft">
                {entry.description}
              </p>
              <Link
                className="mt-6 inline-flex min-h-12 items-center justify-center rounded-[var(--radius-control)] bg-ink px-6 font-bold text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(31,36,33,0.15)] active:scale-95"
                href={entry.href}
              >
                {entry.action}
              </Link>
            </SoftCard>
          ))}
        </section>

        {user.role === "admin" ? (
          <div className="mt-8 flex flex-wrap gap-5 animate-fade-in-up stagger-3">
            <Link
              className="font-bold text-ink-soft hover:text-ink"
              href="/practice/history"
            >
              查看练习记录
            </Link>
            <Link
              className="font-bold text-ink-soft hover:text-ink"
              href="/admin"
            >
              进入管理端
            </Link>
          </div>
        ) : (
          <Link
            className="mt-8 inline-flex animate-fade-in-up stagger-3 font-bold text-ink-soft hover:text-ink"
            href="/practice/history"
          >
            查看练习记录
          </Link>
        )}
      </div>
    </main>
  );
}
