import { PageHeader } from "@/components/ui/page-header";
import { SoftBadge } from "@/components/ui/soft-badge";
import { SoftButtonLink } from "@/components/ui/soft-button";
import { SoftCard } from "@/components/ui/soft-card";
import { requireAdmin } from "@/lib/auth/guards";
import { getScenarioTemplateStore } from "@/lib/runtime/services";

const categoryLabels: Record<string, string> = {
  presale: "售前咨询",
  logistics: "物流问题",
  damage_shortage: "破损少货",
  complaint: "客诉处理",
};

const difficultyLabels: Record<string, string> = {
  easy: "简单",
  medium: "中等",
  hard: "困难",
};

export default async function AdminScenariosPage() {
  await requireAdmin();
  const scenarios = await getScenarioTemplateStore().listPublished();

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          action={
            <SoftButtonLink
              href="/admin/scenarios/generate"
              variant="scenario"
            >
              AI 生成场景
            </SoftButtonLink>
          }
          backHref="/admin"
          description="查看已发布文字训练场景、难度分级与知识依据。"
          label="场景管理"
          title="已发布文字场景"
        />

        <section className="mt-10 grid gap-4 md:grid-cols-2">
          {scenarios.map((scenario, index) => (
            <SoftCard
              className="animate-fade-in-up"
              hover
              key={scenario.versionId}
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <SoftBadge variant="scenario">
                  {categoryLabels[scenario.category] ?? scenario.category}
                </SoftBadge>
                <SoftBadge variant="warning">
                  {difficultyLabels[scenario.difficulty] ?? scenario.difficulty}
                </SoftBadge>
                {scenario.scenarioFocus && (
                  <SoftBadge variant="success">{scenario.scenarioFocus}</SoftBadge>
                )}
                {scenario.mockMode ? (
                  <SoftBadge variant="muted">Mock 评分</SoftBadge>
                ) : (
                  <SoftBadge variant="danger">AI 评分</SoftBadge>
                )}
              </div>
              <h2 className="mt-3 text-lg font-black text-ink">
                {scenario.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                {scenario.summary}
              </p>
              <p className="mt-4 text-xs font-bold text-ink-faint">
                {scenario.sources.length} 个知识依据 · 最多{" "}
                {scenario.maxTurns} 轮
              </p>
            </SoftCard>
          ))}
        </section>
      </div>
    </main>
  );
}
