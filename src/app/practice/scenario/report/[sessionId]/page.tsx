import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/guards";
import { getLocalScenarioTrainingService } from "@/lib/scenario/scenario-service";
import { getScenarioTemplate } from "@/lib/scenario/templates";

import { restartScenarioAction } from "../../actions";

export default async function ScenarioReportPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const user = await requireUser();
  const { sessionId } = await params;
  const session = await loadSession(user.id, sessionId);
  if (session.status === "active") {
    redirect(`/practice/scenario/session/${session.id}`);
  }
  const scenario = getScenarioTemplate(session.scenarioId);
  const report = session.report;
  if (
    !scenario ||
    scenario.versionId !== session.scenarioVersionId ||
    !report
  ) {
    notFound();
  }
  const passed = report.status === "passed";

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-start justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-[#5c7cdb]">训练报告</p>
              <span className="rounded-full bg-[#eef3ff] px-3 py-1 text-xs font-bold text-[#5c7cdb]">
                演示评分
              </span>
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
            通过线80分 · 置信度{" "}
            {Math.round(report.confidence * 100)}%
          </p>
          <p className="mt-3 text-xs leading-6 text-[#8a9690]">
            这是确定性Mock评分，只用于验证产品流程，不代表真实AI评价效果。
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-black text-[#21312a]">五维表现</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {report.dimensions.map((dimension) => (
              <article
                className="rounded-[22px] border-2 border-[#e2e7ef] bg-white p-5"
                key={dimension.name}
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

        <section className="mt-8 rounded-[24px] border-2 border-[#dce8df] bg-white p-6">
          <h2 className="text-xl font-black text-[#21312a]">
            推荐处理流程
          </h2>
          <ol className="mt-4 space-y-3">
            {report.recommendations.map((item, index) => (
              <li className="flex gap-3 leading-7 text-[#526159]" key={item}>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#eaf7ed] text-sm font-black text-[#399a57]">
                  {index + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
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
          <input name="sessionId" type="hidden" value={session.id} />
          <button
            className="min-h-12 w-full rounded-2xl bg-[#6c8bea] px-6 font-black text-white shadow-[0_4px_0_#526fc6] active:translate-y-1 active:shadow-none"
            type="submit"
          >
            重新练习这个场景
          </button>
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
    <section className="rounded-[22px] border-2 border-[#e2e7ef] bg-white p-5">
      <h2 className="font-black text-[#21312a]">{title}</h2>
      <p className="mt-3 leading-7 text-[#68786f]">{children}</p>
    </section>
  );
}

async function loadSession(learnerId: string, sessionId: string) {
  try {
    return await getLocalScenarioTrainingService().load({
      learnerId,
      sessionId,
    });
  } catch {
    notFound();
  }
}
