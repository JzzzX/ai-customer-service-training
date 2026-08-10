"use client";

import { useActionState } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { SoftBadge } from "@/components/ui/soft-badge";
import { SoftButton } from "@/components/ui/soft-button";
import { SoftCard } from "@/components/ui/soft-card";

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

const inputClassName =
  "mt-2 w-full rounded-[var(--radius-control)] border-2 border-surface-muted bg-surface px-4 py-3 text-sm font-bold text-ink outline-none transition-colors focus:border-scenario";

export default function GenerateScenariosPage() {
  const [state, formAction] = useActionState<
    GenerateScenarioState,
    FormData
  >(generateScenariosAction, {});

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          backHref="/admin/scenarios"
          backLabel="返回列表"
          description="基于客服知识库自动生成多样化训练场景，含场景特异性评分维度与难度分级。"
          label="场景管理"
          title="AI 生成训练场景"
        />

        <SoftCard className="mt-10 animate-fade-in-up">
          <form action={formAction} className="space-y-5">
            <div>
              <label
                className="text-sm font-black text-ink"
                htmlFor="category"
              >
                场景类别
              </label>
              <select
                className={inputClassName}
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
              <label className="text-sm font-black text-ink" htmlFor="count">
                生成数量（1-5）
              </label>
              <select
                className={inputClassName}
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
            <SoftButton className="w-full" type="submit" variant="scenario">
              开始生成
            </SoftButton>
          </form>
          {state.error && (
            <SoftCard className="mt-5 border-danger/20 bg-danger-soft">
              <p className="text-sm font-bold text-danger">{state.error}</p>
            </SoftCard>
          )}
        </SoftCard>

        {state.scenarios && state.scenarios.length > 0 && (
          <section className="mt-10 animate-fade-in-up space-y-5">
            <h2 className="text-xl font-black text-ink">
              生成结果（{state.scenarios.length} 个场景）
            </h2>
            {state.scenarios.map((scenario, index) => (
              <SoftCard
                className="animate-fade-in-up"
                key={`${scenario.id}-${index}`}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <SoftBadge variant="scenario">
                    {categoryLabels[scenario.category] ?? scenario.category}
                  </SoftBadge>
                  <SoftBadge variant="warning">
                    {difficultyLabels[scenario.difficulty] ??
                      scenario.difficulty}
                  </SoftBadge>
                  {scenario.scenarioFocus && (
                    <SoftBadge variant="success">
                      {scenario.scenarioFocus}
                    </SoftBadge>
                  )}
                  {scenario.customerPersona && (
                    <SoftBadge variant="muted">
                      {temperamentLabels[scenario.customerPersona.temperament] ??
                        scenario.customerPersona.temperament}
                    </SoftBadge>
                  )}
                </div>
                <h3 className="mt-3 text-lg font-black text-ink">
                  {scenario.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-ink-soft">
                  {scenario.summary}
                </p>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <InfoBlock label="开场白" text={scenario.openingMessage} />
                  <InfoBlock label="参考回复" text={scenario.referenceReply} />
                </div>

                <InfoList label="隐藏事实" items={scenario.hiddenFacts} />
                <InfoList
                  label="参考流程"
                  items={scenario.referenceFlow.map(
                    (step, i) => `${i + 1}. ${step}`,
                  )}
                />

                <div className="mt-5">
                  <p className="text-xs font-black text-ink-faint">
                    场景特异性评分维度
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {scenario.scoringDimensions.map((dim, i) => (
                      <SoftCard
                        className="bg-surface-muted p-3"
                        hover={false}
                        key={i}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-ink-soft">
                            {dim.name}
                          </span>
                          <span className="text-xs font-black text-scenario-strong">
                            {dim.weight}分
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-ink-faint">
                          信号：{dim.signals.join("、")}
                        </p>
                      </SoftCard>
                    ))}
                  </div>
                </div>

                <InfoList
                  label="关键风险"
                  items={scenario.criticalRisks.map(
                    (risk) => `${risk.label}（${risk.patterns.join("、")}）`,
                  )}
                />

                {scenario.customerPersona && (
                  <div className="mt-5 rounded-[var(--radius-control)] bg-surface-muted px-4 py-3">
                    <p className="text-xs font-black text-ink-faint">
                      顾客人设
                    </p>
                    <p className="mt-1 text-sm text-ink-soft">
                      性格：
                      {temperamentLabels[scenario.customerPersona.temperament] ??
                        scenario.customerPersona.temperament}
                      · 知识水平：{scenario.customerPersona.knowledgeLevel}·
                      情绪：{scenario.customerPersona.mood}
                    </p>
                  </div>
                )}
              </SoftCard>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function InfoBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-black text-ink-faint">{label}</p>
      <p className="mt-1 text-sm leading-6 text-ink-soft">{text}</p>
    </div>
  );
}

function InfoList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mt-5">
      <p className="text-xs font-black text-ink-faint">{label}</p>
      <ul className="mt-1 space-y-1">
        {items.map((item, i) => (
          <li className="text-sm text-ink-soft" key={i}>
            · {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
