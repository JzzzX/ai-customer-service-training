import { LearningQuizReportView } from "@/components/report/learning-quiz-report-view";
import { PageHeader } from "@/components/ui/page-header";
import { SoftCard } from "@/components/ui/soft-card";
import { requireUser } from "@/lib/auth/guards";
import { getLearningQuizReport, parseReportRange } from "@/lib/report/service";

export default async function PracticeReportPage({
  searchParams,
}: {
  searchParams?: Promise<{ preset?: string; start?: string; end?: string; learnerId?: string }>;
} = {}) {
  const learner = await requireUser();
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
        {report ? <LearningQuizReportView report={report} basePath="/practice/report" /> : (
          <SoftCard className="mt-6 text-sm text-danger">日期范围无效：{dateError}</SoftCard>
        )}
      </div>
    </main>
  );
}
