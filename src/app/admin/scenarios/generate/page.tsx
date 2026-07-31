"use client";

import { useActionState } from "react";

import {
  generateScenariosAction,
  type GenerateScenarioState,
} from "../actions";

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

const temperamentLabels: Record<string, string> = {
  calm: "平和",
  anxious: "焦虑",
  irritable: "急躁",
  bargain_hunting: "比价型",
};

export default function GenerateScenariosPage() {
  const [state, formAction] = useActionState<
    GenerateScenarioState,
    FormData
  >(generateScenariosAction, {});

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#5c7cdb]">场景管理</p>
            <h1 className="mt-1 text-2xl font-black text-[#21312a]">
              AI 生成训练场景
            </h1>
            <p className="mt-2 text-sm text-[#68786f]">
              基于客服知识库自动生成多样化训练场景，含场景特异性评分维度与难度分级。
            </p>
          </div>
          <a
            className="shrink-0 font-bold text-[#65756d]"
            href="/admin/scenarios"
          >
            返回列表
          </a>
        </header>

        <section className="mt-8 rounded-[24px] border-2 border-[#dde4ef] bg-white p-6">
          <form action={formAction} className="space-y-5">
            <div>
              <label
                className="text-sm font-black text-[#21312a]"
                htmlFor="category"
              >
                场景类别
              </label>
              <select
                className="mt-2 w-full rounded-2xl border-2 border-[#dde4ef] bg-white px-4 py-3 text-sm font-bold text-[#33443b] focus:border-[#7f99ec] focus:outline-none"
                defaultValue="presale"
                id="category"
                name="category"
              >
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                className="text-sm font-black text-[#21312a]"
                htmlFor="count"
              >
                生成数量（1-5）
              </label>
              <select
                className="mt-2 w-full rounded-2xl border-2 border-[#dde4ef] bg-white px-4 py-3 text-sm font-bold text-[#33443b] focus:border-[#7f99ec] focus:outline-none"
                defaultValue="3"
                id="count"
                name="count"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} 个
                  </option>
                ))}
              </select>
            </div>
            <button
              className="min-h-12 w-full rounded-2xl bg-[#6c8bea] px-6 font-black text-white shadow-[0_4px_0_#526fc6] active:translate-y-1 active:shadow-none"
              type="submit"
            >
              开始生成
            </button>
          </form>
          {state.error && (
            <p className="mt-4 rounded-2xl bg-[#fdecec] px-4 py-3 text-sm font-bold text-[#c43c3c]">
              {state.error}
            </p>
          )}
        </section>

        {state.scenarios && state.scenarios.length > 0 && (
          <section className="mt-8 space-y-5">
            <h2 className="text-xl font-black text-[#21312a]">
              生成结果（{state.scenarios.length} 个场景）
            </h2>
            {state.scenarios.map((scenario, index) => (
              <article
                className="rounded-[24px] border-2 border-[#e2e7ef] bg-white p-6"
                key={`${scenario.id}-${index}`}
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
                  {scenario.customerPersona && (
                    <span className="rounded-full bg-[#f5eef7] px-3 py-1 text-xs font-bold text-[#7a4a9a]">
                      {temperamentLabels[scenario.customerPersona.temperament] ?? scenario.customerPersona.temperament}
                    </span>
                  )}
                </div>
                <h3 className="mt-3 text-lg font-black text-[#21312a]">
                  {scenario.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#68786f]">
                  {scenario.summary}
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-black text-[#5c7cdb]">开场白</p>
                    <p className="mt-1 text-sm leading-6 text-[#526159]">
                      {scenario.openingMessage}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-black text-[#5c7cdb]">参考回复</p>
                    <p className="mt-1 text-sm leading-6 text-[#526159]">
                      {scenario.referenceReply}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-xs font-black text-[#5c7cdb]">隐藏事实</p>
                  <ul className="mt-1 space-y-1">
                    {scenario.hiddenFacts.map((fact, i) => (
                      <li
                        className="text-sm text-[#526159]"
                        key={i}
                      >
                        · {fact}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-4">
                  <p className="text-xs font-black text-[#5c7cdb]">参考流程</p>
                  <ol className="mt-1 space-y-1">
                    {scenario.referenceFlow.map((step, i) => (
                      <li
                        className="text-sm text-[#526159]"
                        key={i}
                      >
                        {i + 1}. {step}
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="mt-4">
                  <p className="text-xs font-black text-[#5c7cdb]">
                    场景特异性评分维度
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {scenario.scoringDimensions.map((dim, i) => (
                      <div
                        className="rounded-xl border border-[#e8efe8] bg-[#f7fbf7] px-3 py-2"
                        key={i}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[#33443b]">
                            {dim.name}
                          </span>
                          <span className="text-xs font-black text-[#5c7cdb]">
                            {dim.weight}分
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[#7a8981]">
                          信号：{dim.signals.join("、")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-xs font-black text-[#c43c3c]">关键风险</p>
                  <ul className="mt-1 space-y-1">
                    {scenario.criticalRisks.map((risk, i) => (
                      <li
                        className="text-sm text-[#526159]"
                        key={i}
                      >
                        · {risk.label}（{risk.patterns.join("、")}）
                      </li>
                    ))}
                  </ul>
                </div>
                {scenario.customerPersona && (
                  <div className="mt-4 rounded-xl bg-[#f5eef7] px-4 py-3">
                    <p className="text-xs font-black text-[#7a4a9a]">顾客人设</p>
                    <p className="mt-1 text-sm text-[#526159]">
                      性格：{temperamentLabels[scenario.customerPersona.temperament] ?? scenario.customerPersona.temperament}
                      · 知识水平：{scenario.customerPersona.knowledgeLevel}
                      · 情绪：{scenario.customerPersona.mood}
                    </p>
                  </div>
                )}
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
