"use client";

import { useActionState } from "react";

import { SoftButton } from "@/components/ui/soft-button";

import { loginAction } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, {});

  return (
    <form action={action} className="mt-8 space-y-6">
      <div>
        <span
          aria-hidden="true"
          className="grid size-12 place-items-center rounded-[var(--radius-control)] bg-brand text-xl font-black text-white shadow-[var(--shadow-soft)]"
        >
          AI
        </span>
        <h1 className="mt-5 text-3xl font-black tracking-tight text-ink">
          学员登录
        </h1>
        <p className="mt-2 leading-7 text-ink-soft">
          登录后继续你的知识小测与情景训练。
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
        variant="primary"
      >
        {pending ? "正在登录…" : "登录并继续"}
      </SoftButton>
    </form>
  );
}
