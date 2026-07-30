import Link from "next/link";

import { requireUser } from "@/lib/auth/guards";
import { getScenarioTemplateStore } from "@/lib/runtime/services";
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

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-start justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-[#5c7cdb]">对话训练</p>
              <span className="rounded-full bg-[#eef3ff] px-3 py-1 text-xs font-bold text-[#5c7cdb]">
                演示模式
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-black text-[#21312a]">
              情景实战
            </h1>
            <p className="mt-2 max-w-2xl leading-7 text-[#68786f]">
              选择一个常见客服场景，用文字和模拟顾客连续对话。结果仅用于验证训练体验。
            </p>
          </div>
          <Link
            className="shrink-0 font-bold text-[#65756d]"
            href="/practice"
          >
            返回
          </Link>
        </header>

        <div className="mt-10 space-y-10">
          {categories.map((category) => (
            <section key={category.id}>
              <div>
                <h2 className="text-xl font-black text-[#21312a]">
                  {category.label}
                </h2>
                <p className="mt-1 text-sm text-[#7a8981]">
                  {category.description}
                </p>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {scenarioTemplates
                  .filter(
                    (scenario) => scenario.category === category.id,
                  )
                  .map((scenario) => (
                    <article
                      className="rounded-[24px] border-2 border-[#dde4ef] bg-white p-6"
                      key={scenario.id}
                    >
                      <p className="text-xs font-bold text-[#6a82cf]">
                        最多 {scenario.maxTurns} 轮
                      </p>
                      <h3 className="mt-2 text-lg font-black text-[#21312a]">
                        {scenario.title}
                      </h3>
                      <p className="mt-2 min-h-14 leading-7 text-[#68786f]">
                        {scenario.summary}
                      </p>
                      <Link
                        className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#6c8bea] px-5 font-black text-white shadow-[0_4px_0_#526fc6] active:translate-y-1 active:shadow-none"
                        href={`/practice/scenario/${scenario.id}`}
                      >
                        开始训练
                      </Link>
                    </article>
                  ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
