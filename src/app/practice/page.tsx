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

        <section className="mt-12 rounded-[28px] border-2 border-[#dce8df] bg-white p-7 shadow-[0_7px_0_#dce8df]">
          <p className="text-sm font-bold text-[#399a57]">下一步即将开放</p>
          <h2 className="mt-2 text-3xl font-black text-[#21312a]">
            训练数据底座已就绪
          </h2>
          <p className="mt-3 max-w-2xl leading-7 text-[#68786f]">
            账号与训练记录已经具备安全、可追溯的数据结构。下一 Part
            将接入首批知识小测。
          </p>
          {user.role === "admin" ? (
            <Link
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#6c8bea] px-5 font-bold text-white shadow-[0_4px_0_#526fc6]"
              href="/admin"
            >
              进入管理端
            </Link>
          ) : null}
        </section>
      </div>
    </main>
  );
}
