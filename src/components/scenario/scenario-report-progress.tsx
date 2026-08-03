"use client";

import { ProgressBar } from "@/components/ui/progress-bar";
import { SoftButton } from "@/components/ui/soft-button";
import { WaveLoader } from "@/components/ui/wave-loader";

export type ReportGenerationPhase =
  | "analyzing"
  | "scoring"
  | "saving"
  | "ready"
  | "error";

const steps = [
  { key: "analyzing", label: "分析对话", value: 25 },
  { key: "scoring", label: "生成评分与建议", value: 65 },
  { key: "saving", label: "保存报告", value: 90 },
] as const;

export function ScenarioReportProgress({
  phase,
  error,
  onRetry,
  onView,
}: {
  phase: ReportGenerationPhase;
  error?: string;
  onRetry: () => void;
  onView: () => void;
}) {
  if (phase === "ready") {
    return (
      <div className="mt-5 rounded-[var(--radius-control)] border-2 border-success/20 bg-success-soft px-4 py-4">
        <p className="font-black text-success">报告已生成</p>
        <p className="mt-1 text-sm text-ink-soft">可以查看本次训练的完整反馈了。</p>
        <SoftButton className="mt-3 w-full" onClick={onView} variant="scenario">
          查看训练报告
        </SoftButton>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div
        className="mt-5 rounded-[var(--radius-control)] border-2 border-danger/20 bg-danger-soft px-4 py-4"
        role="alert"
      >
        <p className="font-black text-danger">报告生成失败</p>
        <p className="mt-1 text-sm leading-6 text-ink-soft">
          {error ?? "暂时无法生成报告，请重试。"}
        </p>
        <SoftButton className="mt-3 w-full" onClick={onRetry} variant="secondary">
          重新生成报告
        </SoftButton>
      </div>
    );
  }

  const currentStep = steps.find((step) => step.key === phase) ?? steps[0];
  return (
    <div className="mt-5 rounded-[var(--radius-control)] border border-scenario-border bg-scenario-soft px-4 py-4">
      <div className="flex items-center gap-3">
        <WaveLoader barClassName="bg-scenario" />
        <p className="font-black text-scenario-strong">正在生成训练报告</p>
      </div>
      <ProgressBar
        className="mt-4"
        color="scenario"
        label={`报告生成进度 ${currentStep.value}%`}
        value={currentStep.value}
      />
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-ink-faint">
        {steps.map((step) => (
          <span
            className={step.key === phase ? "text-scenario-strong" : undefined}
            key={step.key}
          >
            {step.label}
          </span>
        ))}
      </div>
      <p className="mt-3 text-sm text-ink-soft">{currentStep.label}…</p>
    </div>
  );
}
