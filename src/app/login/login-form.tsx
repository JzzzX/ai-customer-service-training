"use client";

import { useActionState, useState } from "react";

import { SoftButton } from "@/components/ui/soft-button";

import { loginAction } from "./actions";

type LoginRole = "learner" | "admin";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, {});
  const [role, setRole] = useState<LoginRole>("learner");

  const isLearner = role === "learner";

  return (
    <form action={action} className="mt-8 space-y-6">
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-surface-muted p-1.5">
        <button
          aria-pressed={isLearner}
          className={`rounded-xl py-2.5 text-sm font-bold transition-all ${
            isLearner
              ? "bg-surface text-brand-ink shadow-[var(--shadow-soft)]"
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
              ? "bg-surface text-admin-strong shadow-[var(--shadow-soft)]"
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
          className={`grid size-12 place-items-center rounded-[var(--radius-control)] text-xl font-black text-white shadow-[var(--shadow-soft)] ${
            isLearner ? "bg-brand" : "bg-admin"
          }`}
        >
          AI
        </span>
        <h1 className="mt-5 text-3xl font-black tracking-tight text-ink">
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
            className="mt-2 min-h-12 w-full rounded-[var(--radius-control)] border-2 border-transparent bg-surface-muted px-4 text-ink outline-none transition-all placeholder:text-ink-faint focus:border-brand/30 focus:bg-surface focus:ring-0"
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
            className="mt-2 min-h-12 w-full rounded-[var(--radius-control)] border-2 border-transparent bg-surface-muted px-4 text-ink outline-none transition-all placeholder:text-ink-faint focus:border-brand/30 focus:bg-surface focus:ring-0"
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

      <SoftButton
        className="w-full"
        disabled={pending}
        type="submit"
        variant={isLearner ? "primary" : "scenario"}
      >
        {pending ? "正在登录…" : "登录并继续"}
      </SoftButton>
    </form>
  );
}
