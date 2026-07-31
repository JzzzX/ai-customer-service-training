import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { SoftBadge } from "@/components/ui/soft-badge";
import { SoftButton } from "@/components/ui/soft-button";
import { SoftCard } from "@/components/ui/soft-card";
import { requireUser } from "@/lib/auth/guards";
import {
  getScenarioAiMode,
  getScenarioTemplateStore,
} from "@/lib/runtime/services";

import { startScenarioAction } from "../actions";

export default async function ScenarioDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ scenarioId: string }>;
  searchParams?: Promise<{ assignment?: string }>;
}) {
  await requireUser();
  const { scenarioId } = await params;
  const assignmentInput = (await searchParams)?.assignment;
  const assignmentId =
    assignmentInput &&
    /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(assignmentInput)
      ? assignmentInput
      : undefined;
  const scenario =
    await getScenarioTemplateStore().getPublishedById(scenarioId);
  if (!scenario) {
    notFound();
  }
  const isRealMode = getScenarioAiMode() === "real";

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-2xl">
        <PageHeader
          badge={isRealMode ? "AI 实战" : "演示模式"}
          backHref="/practice/scenario"
          label="开始前"
          title={scenario.title}
        />

        <SoftCard className="mt-8 animate-fade-in-up stagger-1" gradient>
          <SoftBadge variant="scenario">最多 {scenario.maxTurns} 轮</SoftBadge>
          <p className="mt-4 leading-7 text-ink-soft">{scenario.summary}</p>

          <div className="mt-6 rounded-[var(--radius-control)] bg-surface-muted p-5">
            <h2 className="font-black text-ink">你的任务</h2>
            <ul className="mt-3 space-y-3 text-sm leading-6 text-ink-soft">
              {[
                "主动了解必要信息，不要急着给结论。",
                "根据顾客回复推进处理，并明确下一步。",
                "准备好后可主动结束训练，查看训练报告。",
              ].map((item) => (
                <li className="flex items-start gap-3" key={item}>
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <form action={startScenarioAction} className="mt-8">
            <input name="scenarioId" type="hidden" value={scenario.id} />
            {assignmentId ? (
              <input
                name="assignmentId"
                type="hidden"
                value={assignmentId}
              />
            ) : null}
            <SoftButton className="w-full" type="submit" variant="scenario">
              开始模拟接待
            </SoftButton>
          </form>
        </SoftCard>
      </div>
    </main>
  );
}
