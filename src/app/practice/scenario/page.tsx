import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { SoftBadge } from "@/components/ui/soft-badge";
import { SoftCard } from "@/components/ui/soft-card";
import { requireUser } from "@/lib/auth/guards";
import {
  getScenarioAiMode,
  getScenarioTemplateStore,
} from "@/lib/runtime/services";
import type { ScenarioCategory } from "@/lib/scenario/schema";

const categories: Array<{
  id: ScenarioCategory;
  label: string;
  description: string;
}> = [
  {
    id: "presale",
    label: "售前",
    description: "需求挖掘、产品推荐与价格异议",
  },
  {
    id: "logistics",
    label: "物流",
    description: "在途异常、改址拦截与签收问题",
  },
  {
    id: "damage_shortage",
    label: "破损少货",
    description: "凭证收集、责任判断与售后方案",
  },
  {
    id: "complaint",
    label: "客诉",
    description: "适口性、健康风险与升级处理",
  },
];

export default async function ScenarioListPage() {
  await requireUser();
  const scenarioTemplates =
    await getScenarioTemplateStore().listPublished();
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
          description="选择一个常见客服场景，用文字和模拟顾客连续对话，完成训练后获得评分报告。"
          label="对话训练"
          title="情景实战"
        />

        <div className="mt-10 space-y-12 animate-fade-in-up stagger-1">
          {categories.map((category, categoryIndex) => (
            <section key={category.id}>
              <div>
                <h2 className="text-xl font-black text-ink">
                  {category.label}
                </h2>
                <p className="mt-1 text-sm text-ink-faint">
                  {category.description}
                </p>
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
