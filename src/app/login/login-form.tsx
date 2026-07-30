"use client";

import { useActionState, useState } from "react";

import { loginAction } from "./actions";

type LoginRole = "learner" | "admin";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, {});
  const [role, setRole] = useState<LoginRole>("learner");

  const isLearner = role === "learner";

  return (
    <form action={action} className="mt-8 space-y-6">
      <div className="grid grid-cols-2 gap-2 rounded-2xl border-2 border-brand-border bg-canvas p-1.5">
        <button
          aria-pressed={isLearner}
          className={`rounded-xl py-2.5 text-sm font-bold transition-all ${
            isLearner
              ? "bg-surface text-brand-ink shadow-sm"
              : "text-ink-soft hover:text-ink"
          }`}
          onClick={() => setRole("learner")}
          type="button"
        >
          学员
        </button>
        <button
          aria-pressed={!isLearner}
          className={`rounded-xl py-2.5 text-sm font-bold transition-all ${
            !isLearner
              ? "bg-surface text-admin shadow-sm"
              : "text-ink-soft hover:text-ink"
          }`}
          onClick={() => setRole("admin")}
          type="button"
        >
          管理员
        </button>
      </div>

      <div>
        <span
          aria-hidden="true"
          className={`grid size-12 place-items-center rounded-[var(--radius-control)] text-xl font-black text-white shadow-[var(--shadow-btn)] ${
            isLearner ? "bg-brand" : "bg-admin shadow-[var(--shadow-btn-admin)]"
          }`}
        >
          AI
        </span>
        <h1 className="mt-5 text-3xl font-black tracking-[-0.03em] text-ink">
          {isLearner ? "学员登录" : "管理员登录"}
        </h1>
        <p className="mt-2 leading-7 text-ink-soft">
          {isLearner
            ? "登录后继续你的知识小测与情景训练。"
            : "登录后进入培训管理控制台。"}
        </p>
      </div>

      <div className="space-y-5">
        <div>
          <label className="text-sm font-bold text-ink-soft" htmlFor="email">
            邮箱
          </label>
          <input
            autoComplete="email"
            className="mt-2 min-h-12 w-full rounded-2xl border-2 border-brand-border bg-surface px-4 text-ink outline-none transition-colors focus:border-brand"
            id="email"
            name="email"
            placeholder="name@example.com"
            required
            type="email"
          />
        </div>

        <div>
          <label
            className="text-sm font-bold text-ink-soft"
            htmlFor="password"
          >
            密码
          </label>
          <input
            autoComplete="current-password"
            className="mt-2 min-h-12 w-full rounded-2xl border-2 border-brand-border bg-surface px-4 text-ink outline-none transition-colors focus:border-brand"
            id="password"
            name="password"
            required
            type="password"
          />
        </div>

        {state.error ? (
          <p
            aria-live="polite"
            className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger"
            role="alert"
          >
            {state.error}
          </p>
        ) : null}
      </div>

      <button
        className={`min-h-12 w-full rounded-2xl px-5 font-bold text-white shadow-[var(--shadow-btn)] transition-transform enabled:active:translate-y-1 enabled:active:shadow-none disabled:cursor-wait disabled:opacity-70 ${
          isLearner ? "bg-brand" : "bg-admin shadow-[var(--shadow-btn-admin)]"
        }`}
        disabled={pending}
        type="submit"
      >
        {pending ? "正在登录…" : "登录并继续"}
      </button>
    </form>
  );
}
