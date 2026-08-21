import Link from "next/link";

import { LearningQuizReportView } from "@/components/report/learning-quiz-report-view";
import { PageHeader } from "@/components/ui/page-header";
import { SoftCard } from "@/components/ui/soft-card";
import { requireAdmin } from "@/lib/auth/guards";
import { getLearningQuizReport, listReportLearners, parseReportRange } from "@/lib/report/service";

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; learnerId?: string; preset?: string; start?: string; end?: string }>;
} = {}) {
  await requireAdmin();
  const params = await searchParams ?? {};
  const learners = listReportLearners(params.q ?? "");
  let report = null;
  let dateError: string | null = null;
  if (params.learnerId) {
    try {
      report = await getLearningQuizReport(params.learnerId, parseReportRange(params));
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("日期")) throw error;
      dateError = error.message;
    }
  }
  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <PageHeader backHref="/admin" label="管理员只读" title="学员知识测试报告" description="按姓名或邮箱选择学员。管理员只能查看，不能代为练习或修改成绩。" />
        <form className="mt-6 flex gap-2" action="/admin/reports" method="get">
          <input className="min-h-11 min-w-0 flex-1 rounded-[var(--radius-control)] border border-border-soft bg-surface px-4 text-sm" defaultValue={params.q} name="q" placeholder="搜索姓名或邮箱" />
          <button className="rounded-[var(--radius-control)] bg-ink px-5 font-bold text-white" type="submit">搜索</button>
        </form>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {learners.map((learner) => (
            <Link className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-soft)]" href={`/admin/reports?learnerId=${encodeURIComponent(learner.id)}&preset=today&q=${encodeURIComponent(params.q ?? "")}`} key={learner.id}>
              <span className="font-black text-ink">{learner.name}</span><span className="ml-2 text-sm text-ink-soft">{learner.email}</span>
            </Link>
          ))}
        </div>
        {dateError ? <SoftCard className="mt-6 text-sm text-danger">日期范围无效：{dateError}</SoftCard> : report ? (
          <section className="mt-8">
            <h2 className="text-2xl font-black text-ink">{report.learner.name}</h2>
            <p className="mt-1 text-sm text-ink-soft">{report.learner.email}</p>
            <LearningQuizReportView report={report} basePath="/admin/reports" preservedParams={{ learnerId: report.learner.id, ...(params.q ? { q: params.q } : {}) }} />
          </section>
        ) : (
          <SoftCard className="mt-6 text-sm text-ink-soft">请选择一名学员查看报告。</SoftCard>
        )}
      </div>
    </main>
  );
}
