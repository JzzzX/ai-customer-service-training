import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/guards";
import { getScenarioTemplate } from "@/lib/scenario/templates";

import { startScenarioAction } from "../actions";

export default async function ScenarioDetailPage({
  params,
}: {
  params: Promise<{ scenarioId: string }>;
}) {
  await requireUser();
  const { scenarioId } = await params;
  const scenario = getScenarioTemplate(scenarioId);
  if (!scenario) {
    notFound();
  }

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-2xl">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-[#5c7cdb]">开始前</p>
            <span className="rounded-full bg-[#eef3ff] px-3 py-1 text-xs font-bold text-[#5c7cdb]">
              演示模式
            </span>
          </div>
          <Link
            className="font-bold text-[#65756d]"
            href="/practice/scenario"
          >
            返回场景
          </Link>
        </header>

        <section className="mt-8 rounded-[28px] border-2 border-[#dde4ef] bg-white p-7 shadow-[0_7px_0_#dde4ef] sm:p-9">
          <p className="text-xs font-bold text-[#6a82cf]">
            最多 {scenario.maxTurns} 轮
          </p>
          <h1 className="mt-3 text-3xl font-black leading-10 text-[#21312a]">
            {scenario.title}
          </h1>
          <p className="mt-4 leading-7 text-[#68786f]">
            {scenario.summary}
          </p>

          <div className="mt-7 rounded-2xl bg-[#f5f7fb] p-5">
            <h2 className="font-black text-[#33443b]">你的任务</h2>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-[#617068]">
              <li>主动了解必要信息，不要急着给结论。</li>
              <li>根据顾客回复推进处理，并明确下一步。</li>
              <li>准备好后可主动结束训练，查看模拟报告。</li>
            </ul>
          </div>

          <form action={startScenarioAction} className="mt-8">
            <input name="scenarioId" type="hidden" value={scenario.id} />
            <button
              className="min-h-12 w-full rounded-2xl bg-[#6c8bea] px-6 font-black text-white shadow-[0_4px_0_#526fc6] active:translate-y-1 active:shadow-none"
              type="submit"
            >
              开始模拟接待
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
