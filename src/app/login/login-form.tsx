"use client";

import { SoftButton } from "@/components/ui/soft-button";

import {
  demoLoginAction,
  feishuLoginAction,
} from "./actions";

export function LoginForm({
  demoEnabled = false,
}: {
  demoEnabled?: boolean;
}) {
  return (
    <div className="mt-8 space-y-6">
      <form action={feishuLoginAction} className="space-y-6">
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
            使用飞书完成身份验证后，继续知识小测与情景训练。
          </p>
        </div>

        <SoftButton
          className="w-full"
          type="submit"
          variant="primary"
        >
          使用飞书登录
        </SoftButton>
      </form>

      {demoEnabled ? (
        <form action={demoLoginAction} className="space-y-3">
          <SoftButton
            className="w-full"
            type="submit"
            variant="secondary"
          >
            直接进入演示
          </SoftButton>

          <p className="text-center text-xs font-bold text-brand-ink">
            演示环境，不保存数据
          </p>
        </form>
      ) : null}
    </div>
  );
}
