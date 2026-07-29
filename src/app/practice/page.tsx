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
            <p className="text-sm font-bold text-[#399a57]">训练中心</p>
            <h1 className="mt-1 text-2xl font-black text-[#21312a]">
              你好，{user.name}
            </h1>
          </div>
          <SignOutButton />
        </header>

        <section className="mt-12 grid gap-5 md:grid-cols-2">
          <article className="rounded-[28px] border-2 border-[#cfe5d4] bg-white p-7 shadow-[0_7px_0_#cfe5d4]">
            <p className="text-sm font-bold text-[#399a57]">5题 · 约3分钟</p>
            <h2 className="mt-2 text-2xl font-black text-[#21312a]">
              知识小测
            </h2>
            <p className="mt-3 leading-7 text-[#68786f]">
              逐题练习并立即查看解释，完成后可以只重练错题。
            </p>
            <Link
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#65b87a] px-5 font-black text-white shadow-[0_4px_0_#3f9258]"
              href="/practice/quiz"
            >
              开始练习
            </Link>
          </article>

          <article className="rounded-[28px] border-2 border-[#dde4ef] bg-white p-7">
            <p className="text-sm font-bold text-[#6a82cf]">下一 Part</p>
            <h2 className="mt-2 text-2xl font-black text-[#21312a]">
              情景实战
            </h2>
            <p className="mt-3 leading-7 text-[#68786f]">
              在模拟顾客对话中练习售前、物流、破损和客诉处理。
            </p>
          </article>
        </section>

        {user.role === "admin" ? (
          <Link
            className="mt-8 inline-flex font-bold text-[#5c7cdb]"
            href="/admin"
          >
            进入管理端
          </Link>
        ) : null}
      </div>
    </main>
  );
}
