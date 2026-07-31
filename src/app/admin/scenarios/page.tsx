import Link from "next/link";

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
  const scenarios =
    await getScenarioTemplateStore().listPublished();

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#5c7cdb]">场景管理</p>
            <h1 className="mt-1 text-2xl font-black text-[#21312a]">
              已发布文字场景
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Link
              className="rounded-2xl bg-[#6c8bea] px-4 py-2 text-sm font-black text-white shadow-[0_3px_0_#526fc6]"
              href="/admin/scenarios/generate"
            >
              AI 生成场景
            </Link>
            <Link className="font-bold text-[#65756d]" href="/admin">
              返回
            </Link>
          </div>
        </header>
        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {scenarios.map((scenario) => (
            <article
              className="rounded-[22px] border-2 border-[#dde4ef] bg-white p-5"
              key={scenario.versionId}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#eef3ff] px-3 py-1 text-xs font-bold text-[#5c7cdb]">
                  {categoryLabels[scenario.category] ?? scenario.category}
                </span>
                <span className="rounded-full bg-[#fdf8ec] px-3 py-1 text-xs font-bold text-[#a07a1e]">
                  {difficultyLabels[scenario.difficulty] ?? scenario.difficulty}
                </span>
                {scenario.scenarioFocus && (
                  <span className="rounded-full bg-[#eaf7ed] px-3 py-1 text-xs font-bold text-[#399a57]">
                    {scenario.scenarioFocus}
                  </span>
                )}
                {scenario.mockMode ? (
                  <span className="rounded-full bg-[#f0f0f0] px-3 py-1 text-xs font-bold text-[#8a9690]">
                    Mock 评分
                  </span>
                ) : (
                  <span className="rounded-full bg-[#fdecec] px-3 py-1 text-xs font-bold text-[#c43c3c]">
                    AI 评分
                  </span>
                )}
              </div>
              <h2 className="mt-2 text-lg font-black text-[#21312a]">
                {scenario.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#68786f]">
                {scenario.summary}
              </p>
              <p className="mt-3 text-xs text-[#7a8981]">
                {scenario.sources.length} 个知识依据 · 最多{" "}
                {scenario.maxTurns} 轮
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
