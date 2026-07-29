"use client";

import { useActionState } from "react";

import { loginAction } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, {});

  return (
    <form action={action} className="mt-8 space-y-5">
      <div>
        <label className="text-sm font-bold text-[#34483d]" htmlFor="email">
          邮箱
        </label>
        <input
          autoComplete="email"
          className="mt-2 min-h-12 w-full rounded-2xl border-2 border-[#dce8df] bg-white px-4 text-[#21312a] outline-none transition-colors focus:border-[#58cc78]"
          id="email"
          name="email"
          placeholder="name@example.com"
          required
          type="email"
        />
      </div>

      <div>
        <label className="text-sm font-bold text-[#34483d]" htmlFor="password">
          密码
        </label>
        <input
          autoComplete="current-password"
          className="mt-2 min-h-12 w-full rounded-2xl border-2 border-[#dce8df] bg-white px-4 text-[#21312a] outline-none transition-colors focus:border-[#58cc78]"
          id="password"
          name="password"
          required
          type="password"
        />
      </div>

      {state.error ? (
        <p
          aria-live="polite"
          className="rounded-2xl bg-[#fff3f1] px-4 py-3 text-sm font-medium text-[#b94a3b]"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <button
        className="min-h-12 w-full rounded-2xl bg-[#58cc78] px-5 font-bold text-white shadow-[0_4px_0_#3cab5b] transition-transform enabled:active:translate-y-1 enabled:active:shadow-none disabled:cursor-wait disabled:opacity-70"
        disabled={pending}
        type="submit"
      >
        {pending ? "正在登录…" : "登录并继续"}
      </button>
    </form>
  );
}
