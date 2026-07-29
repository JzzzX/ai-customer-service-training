import Link from "next/link";

import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <section className="w-full max-w-md rounded-[28px] border-2 border-[#dce8df] bg-white p-7 shadow-[0_7px_0_#dce8df] sm:p-9">
        <Link
          className="inline-flex items-center gap-2 text-sm font-bold text-[#4d6758]"
          href="/"
        >
          <span aria-hidden="true">←</span>
          返回训练首页
        </Link>

        <div className="mt-8">
          <span
            aria-hidden="true"
            className="grid size-12 place-items-center rounded-2xl bg-[#e9f8ed] text-xl font-black text-[#399a57]"
          >
            AI
          </span>
          <h1 className="mt-5 text-3xl font-black tracking-[-0.03em] text-[#21312a]">
            欢迎回来
          </h1>
          <p className="mt-2 leading-7 text-[#68786f]">
            登录后继续你的知识小测与情景训练。
          </p>
        </div>

        <LoginForm />

        <p className="mt-6 text-center text-sm text-[#7a8981]">
          仅限已分配的培训账号登录
        </p>
      </section>
    </main>
  );
}
