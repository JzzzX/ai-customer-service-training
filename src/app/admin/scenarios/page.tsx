import Link from "next/link";

import { requireAdmin } from "@/lib/auth/guards";
import { getScenarioTemplateStore } from "@/lib/runtime/services";

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
          <Link className="font-bold text-[#65756d]" href="/admin">
            返回
          </Link>
        </header>
        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {scenarios.map((scenario) => (
            <article
              className="rounded-[22px] border-2 border-[#dde4ef] bg-white p-5"
              key={scenario.versionId}
            >
              <p className="text-xs font-bold text-[#6a82cf]">
                {scenario.category} · Mock 评分
              </p>
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
