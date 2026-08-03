import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress-bar";
import { SoftBadge } from "@/components/ui/soft-badge";
import { SoftCard } from "@/components/ui/soft-card";
import { requireUser } from "@/lib/auth/guards";
import {
  getScenarioAiMode,
  getScenarioTrainingService,
  getScenarioTemplateStore,
} from "@/lib/runtime/services";
import type { ScenarioCategory } from "@/lib/scenario/schema";

const categories: Array<{
  id: ScenarioCategory;
  icon: string;
  label: string;
  description: string;
}> = [
  {
    id: "presale",
    icon: "🛍️",
    label: "售前",
    description: "需求挖掘、产品推荐与价格异议",
  },
  {
    id: "logistics",
    icon: "🚚",
    label: "物流",
    description: "在途异常、改址拦截与签收问题",
  },
  {
    id: "damage_shortage",
    icon: "📦",
    label: "破损少货",
    description: "凭证收集、责任判断与售后方案",
  },
  {
    id: "complaint",
    icon: "💬",
    label: "客诉",
    description: "适口性、健康风险与升级处理",
  },
];

export default async function ScenarioListPage() {
  const user = await requireUser();
  const scenarioTemplates =
    await getScenarioTemplateStore().listPublished();
  const progress = await getScenarioTrainingService().getProgress({
    learnerId: user.id,
    publishedScenarioCount: scenarioTemplates.length,
    publishedScenarioIds: scenarioTemplates.map((scenario) => scenario.id),
    includeDetails: false,
  });
  const isRealMode = getScenarioAiMode() === "real";

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          action={
            <SoftBadge variant={isRealMode ? "success" : "scenario"}>
              {isRealMode ? "AI 实战" : "演示模式"}
            </SoftBadge>
          }
          backHref="/practice"
          backIconOnly
          backLabel="返回训练中心"
          description="选择一个常见客服场景，用文字和模拟顾客连续对话，完成训练后获得评分报告。"
          label="对话训练"
          title="情景实战"
        />

        <section className="mt-7 grid gap-4 sm:grid-cols-[1.4fr_1fr] animate-fade-in-up">
          <SoftCard gradient>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-ink-faint">实战进度</p>
                <p className="mt-2 text-xl font-black text-ink">
                  已完成 {progress.completedScenarioCount} /{" "}
                  {progress.publishedScenarioCount} 个场景
                </p>
              </div>
              <p className="text-right text-sm font-bold text-scenario-strong">
                最近平均 {progress.recentAverageScore} 分
                <span className="mt-1 block text-xs font-normal text-ink-faint">
                  累计 {progress.completedSessionCount} 次实战
                </span>
              </p>
            </div>
            <ProgressBar
              className="mt-4"
              color="scenario"
              value={progress.completedScenarioCount}
              max={Math.max(progress.publishedScenarioCount, 1)}
            />
            <Link
              className="mt-4 inline-flex font-bold text-scenario-strong hover:underline"
              href="/practice/profile?tab=scenario"
            >
              查看详细记录
              <span aria-hidden="true" className="ml-1">→</span>
            </Link>
          </SoftCard>
          <SoftCard>
            <p className="text-xs font-bold text-ink-faint">练习提示</p>
            <p className="mt-2 leading-7 text-ink-soft">
              完成不同场景可以扩大覆盖；重复练习同一场景会继续积累评分表现。
            </p>
          </SoftCard>
        </section>

        <div className="mt-10 space-y-12 animate-fade-in-up stagger-1">
          {categories.map((category, categoryIndex) => (
            <section key={category.id}>
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-10 items-center justify-center rounded-2xl bg-scenario-soft text-xl"
                >
                  {category.icon}
                </span>
                <div>
                  <h2 className="text-xl font-black text-ink">
                    {category.label}
                  </h2>
                  <p className="mt-1 text-sm text-ink-faint">
                    {category.description}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {scenarioTemplates
                  .filter(
                    (scenario) => scenario.category === category.id,
                  )
                  .map((scenario, index) => (
                    <SoftCard
                      className="animate-fade-in-up"
                      gradient
                      hover
                      key={scenario.id}
                      style={{
                        animationDelay: `${(categoryIndex * 2 + index) * 60}ms`,
                      }}
                    >
                      <SoftBadge variant="scenario">
                        最多 {scenario.maxTurns} 轮
                      </SoftBadge>
                      <h3 className="mt-3 text-lg font-black text-ink">
                        {scenario.title}
                      </h3>
                      <p className="mt-2 min-h-14 text-sm leading-6 text-ink-soft">
                        {scenario.summary}
                      </p>
                      <Link
                        className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-[var(--radius-control)] bg-scenario px-5 font-bold text-white shadow-[0_4px_14px_rgba(138,160,200,0.28)] transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(138,160,200,0.35)] active:scale-95"
                        href={`/practice/scenario/${scenario.id}`}
                      >
                        开始训练
                      </Link>
                    </SoftCard>
                  ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
