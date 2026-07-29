import Link from "next/link";

import { SignOutButton } from "@/components/sign-out-button";
import { requireAdmin } from "@/lib/auth/guards";

export default async function AdminPage() {
  const user = await requireAdmin();

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#5c7cdb]">培训管理</p>
            <h1 className="mt-1 text-2xl font-black text-[#21312a]">
              管理员控制台
            </h1>
          </div>
          <SignOutButton />
        </header>

        <section className="mt-12 grid gap-5 md:grid-cols-3">
          {["题库管理", "场景管理", "学习记录"].map((title) => (
            <article
              className="rounded-[24px] border-2 border-[#dde4ef] bg-white p-6"
              key={title}
            >
              <h2 className="text-xl font-black text-[#21312a]">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#68786f]">
                数据结构已建立，功能将在后续 Part 逐步开放。
              </p>
            </article>
          ))}
        </section>

        <p className="mt-8 text-sm text-[#7a8981]">
          当前账号：{user.email}
        </p>
        <Link
          className="mt-4 inline-flex font-bold text-[#399a57]"
          href="/practice"
        >
          返回训练中心
        </Link>
      </div>
    </main>
  );
}
