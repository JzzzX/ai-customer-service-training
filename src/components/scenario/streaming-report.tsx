"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  completeScenarioAction,
  restartScenarioAction,
} from "@/app/practice/scenario/actions";
import type {
  ScenarioEvaluationReport,
  ScenarioTemplate,
} from "@/lib/scenario/schema";

type PartialDimension = {
  name: string;
  score?: number;
  evidence?: string[];
};

type PartialEvaluation = {
  confidence?: number;
  dimensions?: PartialDimension[];
};

type StreamingState =
  | { phase: "streaming"; partial: PartialEvaluation; deltaLength: number }
  | { phase: "complete"; report: ScenarioEvaluationReport }
  | { phase: "error"; message: string };

export function StreamingReport({
  sessionId,
  scenario,
}: {
  sessionId: string;
  scenario: ScenarioTemplate;
}) {
  const router = useRouter();
  const [state, setState] = useState<StreamingState>({
    phase: "streaming",
    partial: {},
    deltaLength: 0,
  });

  useEffect(() => {
    let cancelled = false;
    let accumulated = "";

    (async () => {
      try {
        const response = await fetch(
          `/api/scenario/complete/${sessionId}`,
        );
        if (!response.ok || !response.body) {
          throw new Error(
            response.status === 401
              ? "未登录，请重新登录后重试。"
              : "连接评测服务失败，请稍后重试。",
          );
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const event of events) {
            const data = event.replace(/^data: /, "").trim();
            if (!data || data === "[DONE]") continue;
            let chunk: {
              delta?: string;
              report?: ScenarioEvaluationReport;
              session?: unknown;
              error?: string;
            };
            try {
              chunk = JSON.parse(data);
            } catch {
              continue;
            }
            if (chunk.error) {
              throw new Error(chunk.error);
            }
            if (chunk.delta) {
              accumulated += chunk.delta;
              if (!cancelled) {
                setState({
                  phase: "streaming",
                  partial: parsePartialEvaluation(accumulated),
                  deltaLength: accumulated.length,
                });
              }
            }
            if (chunk.report) {
              if (!cancelled) {
                setState({ phase: "complete", report: chunk.report });
                router.replace(
                  `/practice/scenario/report/${sessionId}`,
                );
              }
            }
          }
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            phase: "error",
            message:
              error instanceof Error
                ? error.message
                : "报告生成失败，请稍后重试。",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, router]);

  useEffect(() => {
    if (state.phase !== "error") return;
    const formData = new FormData();
    formData.set("sessionId", sessionId);
    void completeScenarioAction(formData);
  }, [state, sessionId]);

  if (state.phase === "streaming") {
    return (
      <StreamingSkeleton
        partial={state.partial}
        deltaLength={state.deltaLength}
        scenario={scenario}
      />
    );
  }
  if (state.phase === "error") {
    return <ErrorFallback message={state.message} />;
  }
  return (
    <ReportView
      report={state.report}
      scenario={scenario}
      sessionId={sessionId}
    />
  );
}

function parsePartialEvaluation(text: string): PartialEvaluation {
  const result: PartialEvaluation = {};

  const confMatch = text.match(/"confidence"\s*:\s*([0-9.]+)/);
  if (confMatch) {
    result.confidence = Number(confMatch[1]);
  }

  const dimsMatch = text.match(/"dimensions"\s*:\s*\[([\s\S]*)/);
  if (dimsMatch) {
    const dimsText = dimsMatch[1];
    const dimensions: PartialDimension[] = [];
    let depth = 0;
    let start = -1;
    for (let i = 0; i < dimsText.length; i++) {
      const char = dimsText[i];
      if (char === "{") {
        if (depth === 0) start = i;
        depth++;
      } else if (char === "}") {
        depth--;
        if (depth === 0 && start >= 0) {
          try {
            const obj = JSON.parse(dimsText.slice(start, i + 1)) as Record<
              string,
              unknown
            >;
            if (typeof obj.name === "string") {
              dimensions.push({
                name: obj.name,
                score: typeof obj.score === "number" ? obj.score : undefined,
                evidence: Array.isArray(obj.evidence)
                  ? obj.evidence.map(String)
                  : undefined,
              });
            }
          } catch {
            // incomplete object — skip
          }
          start = -1;
        }
      } else if (char === "]" && depth === 0) {
        break;
      }
    }
    if (dimensions.length > 0) {
      result.dimensions = dimensions;
    }
  }

  return result;
}

function StreamingSkeleton({
  partial,
  deltaLength,
  scenario,
}: {
  partial: PartialEvaluation;
  deltaLength: number;
  scenario: ScenarioTemplate;
}) {
  const partialDims = partial.dimensions ?? [];
  const partialMap = new Map(partialDims.map((d) => [d.name, d]));

  return (
    <div>
      <header className="flex items-start justify-between gap-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-[#5c7cdb]">训练报告</p>
            <span className="rounded-full bg-[#eef3ff] px-3 py-1 text-xs font-bold text-[#5c7cdb]">
              生成中
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-black text-[#21312a]">
            AI 正在分析对话…
          </h1>
          <p className="mt-2 text-[#68786f]">{scenario.title}</p>
        </div>
        <Link
          className="shrink-0 font-bold text-[#65756d]"
          href="/practice/scenario"
        >
          返回场景
        </Link>
      </header>

      <section className="mt-8 rounded-[28px] border-2 border-[#dde4ef] bg-white p-7 text-center shadow-[0_7px_0_#dde4ef]">
        <div className="flex items-center justify-center gap-2">
          <span className="size-3 animate-pulse rounded-full bg-[#7f99ec]" />
          <span className="size-3 animate-pulse rounded-full bg-[#7f99ec] [animation-delay:150ms]" />
          <span className="size-3 animate-pulse rounded-full bg-[#7f99ec] [animation-delay:300ms]" />
        </div>
        <p className="mt-4 text-sm font-bold text-[#68786f]">
          正在生成评分与建议{deltaLength > 0 ? ` · 已生成 ${deltaLength} 字` : ""}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-black text-[#21312a]">五维表现</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {scenario.scoringDimensions.map((dimension) => {
            const partial = partialMap.get(dimension.name);
            return (
              <article
                className="rounded-[22px] border-2 border-[#e2e7ef] bg-white p-5"
                key={dimension.name}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-black text-[#33443b]">
                    {dimension.name}
                  </h3>
                  <p className="shrink-0 font-black text-[#5c7cdb]">
                    {partial?.score !== undefined
                      ? `${partial.score}/${dimension.weight}`
                      : `—/${dimension.weight}`}
                  </p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#edf0f6]">
                  <div
                    className="h-full rounded-full bg-[#7f99ec] transition-all duration-500"
                    style={{
                      width: partial?.score
                        ? `${Math.round((partial.score / dimension.weight) * 100)}%`
                        : "0%",
                    }}
                  />
                </div>
                <p className="mt-3 text-xs leading-5 text-[#7a8981]">
                  {partial?.evidence && partial.evidence.length > 0
                    ? `识别证据：${partial.evidence.join("、")}`
                    : "分析中…"}
                </p>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ErrorFallback({ message }: { message: string }) {
  return (
    <div>
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-[#5c7cdb]">训练报告</p>
          <span className="rounded-full bg-[#fff1e5] px-3 py-1 text-xs font-bold text-[#b56127]">
            生成失败
          </span>
        </div>
        <h1 className="mt-2 text-3xl font-black text-[#21312a]">
          报告生成遇到问题
        </h1>
      </header>
      <section className="mt-8 rounded-[22px] border-2 border-[#f0e2c4] bg-[#fdf8ec] p-5">
        <p className="text-sm leading-6 text-[#68786f]">{message}</p>
        <p className="mt-2 text-sm font-bold text-[#a07a1e]">
          正在自动重试，请稍候…
        </p>
      </section>
    </div>
  );
}

function ReportView({
  report,
  scenario,
  sessionId,
}: {
  report: ScenarioEvaluationReport;
  scenario: ScenarioTemplate;
  sessionId: string;
}) {
  const passed = report.status === "passed";
  const isRealMode = report.mode === "real";

  return (
    <div>
      <header className="flex items-start justify-between gap-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-[#5c7cdb]">训练报告</p>
            {isRealMode ? (
              <span className="rounded-full bg-[#eaf7ed] px-3 py-1 text-xs font-bold text-[#399a57]">
                AI 评分
              </span>
            ) : (
              <span className="rounded-full bg-[#eef3ff] px-3 py-1 text-xs font-bold text-[#5c7cdb]">
                演示评分
              </span>
            )}
          </div>
          <h1 className="mt-2 text-3xl font-black text-[#21312a]">
            {passed ? "本次训练通过" : "本次需要重练"}
          </h1>
          <p className="mt-2 text-[#68786f]">{scenario.title}</p>
        </div>
        <Link
          className="shrink-0 font-bold text-[#65756d]"
          href="/practice/scenario"
        >
          返回场景
        </Link>
      </header>

      <section className="mt-8 rounded-[28px] border-2 border-[#dde4ef] bg-white p-7 text-center shadow-[0_7px_0_#dde4ef]">
        <p
          className={`text-5xl font-black ${
            passed ? "text-[#399a57]" : "text-[#b56127]"
          }`}
        >
          {report.totalScore}分
        </p>
        <p className="mt-3 text-sm font-bold text-[#68786f]">
          通过线80分 · 置信度 {Math.round(report.confidence * 100)}%
        </p>
        <p className="mt-3 text-xs leading-6 text-[#8a9690]">
          {isRealMode
            ? "本次评分由 AI 根据对话内容生成，可作为训练参考。"
            : "这是确定性Mock评分，只用于验证产品流程，不代表真实AI评价效果。"}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-black text-[#21312a]">五维表现</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {report.dimensions.map((dimension, index) => (
            <article
              className="animate-[fadeInUp_0.4s_ease-out_both] rounded-[22px] border-2 border-[#e2e7ef] bg-white p-5"
              key={dimension.name}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-black text-[#33443b]">
                  {dimension.name}
                </h3>
                <p className="shrink-0 font-black text-[#5c7cdb]">
                  {dimension.score}/{dimension.maxScore}
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#edf0f6]">
                <div
                  className="h-full rounded-full bg-[#7f99ec]"
                  style={{
                    width: `${Math.round(
                      (dimension.score / dimension.maxScore) * 100,
                    )}%`,
                  }}
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-[#7a8981]">
                识别证据：
                {dimension.evidence.length > 0
                  ? dimension.evidence.join("、")
                  : "暂未识别"}
              </p>
            </article>
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <ReportCard title="做得好的部分">
          {report.strengths.length > 0
            ? `已覆盖：${report.strengths.join("、")}。`
            : "本次尚未形成稳定优势。"}
        </ReportCard>
        <ReportCard title="遗漏与风险">
          {report.missedSteps.length > 0
            ? `需要加强：${report.missedSteps.join("、")}。`
            : "本次未识别到明显漏项。"}
          {report.risks.length > 0
            ? ` 关键风险：${report.risks.join("、")}。`
            : " 未识别到关键风险。"}
        </ReportCard>
      </div>

      {report.lowConfidence && (
        <section className="mt-8 rounded-[22px] border-2 border-[#f0e2c4] bg-[#fdf8ec] p-5">
          <p className="text-sm font-bold text-[#a07a1e]">
            本次评分置信度较低，建议人工复核后再作为考核依据。
          </p>
        </section>
      )}

      <section className="mt-8 rounded-[24px] border-2 border-[#dce8df] bg-white p-6">
        <h2 className="text-xl font-black text-[#21312a]">改进建议</h2>
        <div className="mt-4 space-y-4">
          {report.recommendations.map((item, index) => (
            <article
              className="animate-[fadeInUp_0.4s_ease-out_both] rounded-[18px] border-2 border-[#e8efe8] bg-[#f7fbf7] p-4"
              key={`${item.issue}-${index}`}
              style={{ animationDelay: `${400 + index * 80}ms` }}
            >
              <div className="flex items-start gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#eaf7ed] text-sm font-black text-[#399a57]">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-[#b56127]">
                    问题：{item.issue}
                  </p>
                  <p className="mt-2 leading-7 text-[#526159]">
                    建议回复：{item.suggestedReply}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-[24px] border-2 border-[#dde4ef] bg-white p-6">
        <h2 className="text-xl font-black text-[#21312a]">参考回复</h2>
        <p className="mt-4 leading-8 text-[#526159]">
          {report.referenceReply}
        </p>
        <p className="mt-4 text-xs text-[#87928c]">
          知识来源：
          {scenario.sources
            .map((source) => `${source.sourcePath} · ${source.anchor}`)
            .join("；")}
        </p>
      </section>

      <form action={restartScenarioAction} className="mt-7">
        <input name="sessionId" type="hidden" value={sessionId} />
        <button
          className="min-h-12 w-full rounded-2xl bg-[#6c8bea] px-6 font-black text-white shadow-[0_4px_0_#526fc6] active:translate-y-1 active:shadow-none"
          type="submit"
        >
          重新练习这个场景
        </button>
      </form>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function ReportCard({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-[22px] border-2 border-[#e2e7ef] bg-white p-5">
      <h2 className="font-black text-[#21312a]">{title}</h2>
      <p className="mt-3 leading-7 text-[#68786f]">{children}</p>
    </section>
  );
}
