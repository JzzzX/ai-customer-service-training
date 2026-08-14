"use client";

import { useActionState } from "react";

import { startScenarioAction } from "@/app/practice/scenario/actions";
import { SoftButton } from "@/components/ui/soft-button";

export function ScenarioStartForm({ scenarioId }: { scenarioId: string }) {
  const [state, action, pending] = useActionState(startScenarioAction, {});

  return (
    <form action={action} className="mt-8">
      <input name="scenarioId" type="hidden" value={scenarioId} />
      {state.error ? (
        <div
          className="mb-4 rounded-[var(--radius-control)] bg-danger-soft px-4 py-3 text-sm font-medium text-danger"
          role="alert"
        >
          <p>{state.error}</p>
          {state.incidentId ? (
            <p className="mt-1 text-xs">问题编号：{state.incidentId}</p>
          ) : null}
        </div>
      ) : null}
      <SoftButton
        className="w-full"
        disabled={pending}
        type="submit"
        variant="scenario"
      >
        {pending
          ? "正在创建会话…"
          : state.error
            ? "重新尝试"
            : "开始模拟接待"}
      </SoftButton>
    </form>
  );
}
