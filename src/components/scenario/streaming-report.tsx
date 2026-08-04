"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress-bar";
import { SoftBadge } from "@/components/ui/soft-badge";
import { SoftButton } from "@/components/ui/soft-button";
import { SoftCard } from "@/components/ui/soft-card";
import { WaveLoader } from "@/components/ui/wave-loader";
import {
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
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<StreamingState>({
    phase: "streaming",
    partial: {},
    deltaLength: 0,
  });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    let accumulated = "";

    (async () => {
      try {
        const response = await fetch(
          `/api/scenario/complete/${sessionId}`,
          { signal: controller.signal },
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
        if (cancelled || controller.signal.aborted) return;
        setState({
          phase: "error",
          message:
            error instanceof Error
              ? error.message
              : "报告生成失败，请稍后重试。",
        });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [sessionId, router, attempt]);

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
    return (
      <ErrorFallback
        message={state.message}
        onRetry={() => {
          setState({ phase: "streaming", partial: {}, deltaLength: 0 });
          setAttempt((current) => current + 1);
        }}
      />
    );
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
      <PageHeader
        badge="生成中"
        backHref="/practice/scenario"
        description={scenario.title}
        label="训练报告"
        title="AI 正在聆听对话…"
      />

      <SoftCard className="mt-8 text-center" gradient>
        <WaveLoader barClassName="bg-scenario" />
        <p className="mt-4 text-sm font-bold text-ink-soft">
          正在生成评分与建议
          {deltaLength > 0 ? ` · 已生成 ${deltaLength} 字` : ""}
        </p>
      </SoftCard>

      <section className="mt-8">
        <h2 className="text-xl font-black text-ink">五维表现</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {scenario.scoringDimensions.map((dimension) => {
            const partial = partialMap.get(dimension.name);
            return (
              <SoftCard hover={false} key={dimension.name}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-black text-ink">
                    {dimension.name}
                  </h3>
                  <p className="shrink-0 font-black text-scenario-strong">
                    {partial?.score !== undefined
                      ? `${partial.score}/${dimension.weight}`
                      : `—/${dimension.weight}`}
                  </p>
                </div>
                <ProgressBar
                  className="mt-3"
                  color="scenario"
                  value={partial?.score ?? 0}
                  max={dimension.weight}
                />
                <p className="mt-3 text-xs leading-5 text-ink-faint">
                  {partial?.evidence && partial.evidence.length > 0
                    ? `识别证据：${partial.evidence.join("、")}`
                    : "分析中…"}
                </p>
              </SoftCard>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ErrorFallback({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div>
      <PageHeader
        badge="生成失败"
        label="训练报告"
        title="报告生成遇到问题"
      />
      <SoftCard className="mt-8" gradient>
        <p className="text-sm leading-6 text-ink-soft">{message}</p>
        <p className="mt-2 text-sm font-bold text-warning">
          可点击下方按钮重新生成报告。
        </p>
        <SoftButton
          className="mt-5 w-full"
          onClick={onRetry}
          variant="scenario"
        >
          重新生成报告
        </SoftButton>
      </SoftCard>
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
    <div className="animate-fade-in-up">
      <PageHeader
        action={
          <SoftBadge variant={isRealMode ? "success" : "scenario"}>
            {isRealMode ? "AI 评分" : "演示评分"}
          </SoftBadge>
        }
        backHref="/practice/scenario"
        description={scenario.title}
        label="训练报告"
        title={passed ? "本次训练通过" : "本次需要重练"}
      />

      <SoftCard className="mt-8 text-center" gradient>
        <p
          className={`text-6xl font-black ${
            passed ? "text-success" : "text-warning"
          }`}
        >
          {report.totalScore}分
        </p>
        <p className="mt-3 text-sm font-bold text-ink-soft">
          通过线80分 · 置信度 {Math.round(report.confidence * 100)}%
        </p>
        <p className="mt-3 text-xs leading-6 text-ink-faint">
          {isRealMode
            ? "本次评分由 AI 根据对话内容生成，可作为训练参考。"
            : "这是确定性Mock评分，只用于验证产品流程，不代表真实AI评价效果。"}
        </p>
      </SoftCard>

      <section className="mt-8">
        <h2 className="text-xl font-black text-ink">五维表现</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {report.dimensions.map((dimension, index) => (
            <SoftCard
              className="animate-fade-in-up"
              hover
              key={dimension.name}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-black text-ink">
                  {dimension.name}
                </h3>
                <p className="shrink-0 font-black text-scenario-strong">
                  {dimension.score}/{dimension.maxScore}
                </p>
              </div>
              <ProgressBar
                className="mt-3"
                color="scenario"
                value={dimension.score}
                max={dimension.maxScore}
              />
              <p className="mt-3 text-xs leading-5 text-ink-faint">
                识别证据：
                {dimension.evidence.length > 0
                  ? dimension.evidence.join("、")
                  : "暂未识别"}
              </p>
            </SoftCard>
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
        <SoftCard className="mt-8" gradient>
          <p className="text-sm font-bold text-warning">
            本次评分置信度较低，建议人工复核后再作为考核依据。
          </p>
        </SoftCard>
      )}

      <section className="mt-8">
        <h2 className="text-xl font-black text-ink">改进建议</h2>
        <div className="mt-4 space-y-4">
          {report.recommendations.map((item, index) => (
            <SoftCard
              className="animate-fade-in-up"
              hover={false}
              key={`${item.issue}-${index}`}
              style={{ animationDelay: `${400 + index * 80}ms` }}
            >
              <div className="flex items-start gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-sm font-black text-brand-ink">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-warning">
                    问题：{item.issue}
                  </p>
                  <p className="mt-2 leading-7 text-ink-soft">
                    建议回复：{item.suggestedReply}
                  </p>
                </div>
              </div>
            </SoftCard>
          ))}
        </div>
      </section>

      <SoftCard className="mt-5" gradient>
        <h2 className="text-xl font-black text-ink">参考回复</h2>
        <p className="mt-4 leading-8 text-ink-soft">
          {report.referenceReply}
        </p>
        <p className="mt-4 text-xs text-ink-faint">
          知识来源：
          {scenario.sources
            .map((source) => `${source.sourcePath} · ${source.anchor}`)
            .join("；")}
        </p>
      </SoftCard>

      <form action={restartScenarioAction} className="mt-7">
        <input name="sessionId" type="hidden" value={sessionId} />
        <SoftButton className="w-full" type="submit" variant="scenario">
          重新练习这个场景
        </SoftButton>
      </form>
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
    <SoftCard gradient>
      <h2 className="font-black text-ink">{title}</h2>
      <p className="mt-3 leading-7 text-ink-soft">{children}</p>
    </SoftCard>
  );
}
