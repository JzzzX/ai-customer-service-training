import { LearningQuizReportView } from "@/components/report/learning-quiz-report-view";
import { PageHeader } from "@/components/ui/page-header";
import { SoftCard } from "@/components/ui/soft-card";
import { requireLearner } from "@/lib/auth/guards";
import { getLearningQuizReport, parseReportRange } from "@/lib/report/service";

export default async function PracticeReportPage({
  searchParams,
}: {
  searchParams?: Promise<{ preset?: string; start?: string; end?: string; learnerId?: string; remediation?: string; category?: string; required?: string; available?: string }>;
} = {}) {
  const learner = await requireLearner();
  const params = await searchParams ?? {};
  let report;
  let dateError: string | null = null;
  try {
    report = await getLearningQuizReport(learner.id, parseReportRange(params));
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("日期")) throw error;
    dateError = error.message;
  }
  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <PageHeader backHref="/practice" label="知识学习" title="知识测试整体报告" description="汇总正式测试、专题练习和薄弱点考卷；情景实战不在本报告中。" />
        {params.remediation === "no-weakness" ? <SoftCard className="mt-6 text-sm text-ink-soft">当前报告没有错题，暂时无需生成改善考卷。</SoftCard> : null}
        {params.remediation === "insufficient-bank" ? <SoftCard className="mt-6 text-sm text-danger">{params.category} 当前可用题库不足 {params.required === "5" ? 5 : 10} 题（可用 {params.available ?? 0} 题），未生成考卷。</SoftCard> : null}
        {report ? <LearningQuizReportView report={report} basePath="/practice/report" allowRemediationGeneration /> : (
          <SoftCard className="mt-6 text-sm text-danger">日期范围无效：{dateError}</SoftCard>
        )}
      </div>
    </main>
  );
}
