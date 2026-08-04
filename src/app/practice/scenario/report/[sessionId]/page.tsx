import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress-bar";
import { SoftBadge } from "@/components/ui/soft-badge";
import { SoftButton } from "@/components/ui/soft-button";
import { SoftCard } from "@/components/ui/soft-card";
import { StreamingReport } from "@/components/scenario/streaming-report";
import { requireUser } from "@/lib/auth/guards";
import {
  getScenarioTemplateStore,
  getScenarioTrainingService,
} from "@/lib/runtime/services";

import { restartScenarioAction } from "../../actions";

export default async function ScenarioReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ streaming?: string }>;
}) {
  const user = await requireUser();
  const { sessionId } = await params;
  const { streaming } = await searchParams;
  const session = await loadSession(user.id, sessionId);

  if (streaming === "1" && session.status === "active") {
    const scenario = await getScenarioTemplateStore().getPublishedById(
      session.scenarioId,
    );
    if (!scenario || scenario.versionId !== session.scenarioVersionId) {
      notFound();
    }
    return (
      <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-4xl">
          <StreamingReport sessionId={session.id} scenario={scenario} />
        </div>
      </main>
    );
  }

  if (session.status === "active") {
    redirect(`/practice/scenario/session/${session.id}`);
  }
  const scenario =
    await getScenarioTemplateStore().getPublishedById(
      session.scenarioId,
    );
  const report = session.report;
  if (
    !scenario ||
    scenario.versionId !== session.scenarioVersionId ||
    !report
  ) {
    notFound();
  }
  const passed = report.status === "passed";
  const isRealMode = report.mode === "real";

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-4xl">
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
            通过线80分 · 置信度{" "}
            {Math.round(report.confidence * 100)}%
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
          <input name="sessionId" type="hidden" value={session.id} />
          <SoftButton className="w-full" type="submit" variant="scenario">
            重新练习这个场景
          </SoftButton>
        </form>
      </div>
    </main>
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

async function loadSession(learnerId: string, sessionId: string) {
  try {
    return await getScenarioTrainingService().load({
      learnerId,
      sessionId,
    });
  } catch {
    notFound();
  }
}
