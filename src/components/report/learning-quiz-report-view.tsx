import Link from "next/link";
import { generateRemediationExamAction } from "@/app/practice/report/actions";

import { SoftBadge } from "@/components/ui/soft-badge";
import { SoftCard } from "@/components/ui/soft-card";
import type { LearningQuizReport } from "@/lib/report/learning-quiz-report";

const dateTime = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Shanghai",
});

export function LearningQuizReportView({
  report,
  basePath,
  preservedParams = {},
  allowRemediationGeneration = false,
}: {
  report: LearningQuizReport;
  basePath: string;
  preservedParams?: Record<string, string>;
  allowRemediationGeneration?: boolean;
}) {
  return (
    <>
      <RangePicker report={report} basePath={basePath} preservedParams={preservedParams} />
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="完成次数" value={`${report.summary.completedAttempts} 次`} />
        <Metric label="答题数" value={`${report.summary.answeredCount} 题`} />
        <Metric label="正确率" value={`${report.summary.accuracy}%`} />
        <Metric label="通过率" value={`${report.summary.passRate}%`} />
      </section>
      {allowRemediationGeneration ? (
        <form action={generateRemediationExamAction} className="mt-4">
          <input name="preset" type="hidden" value={report.range.preset} /><input name="start" type="hidden" value={report.range.startDate} /><input name="end" type="hidden" value={report.range.endDate} />
          <button className="min-h-11 rounded-[var(--radius-control)] bg-brand px-5 font-bold text-white" type="submit">根据薄弱点生成 10 题改善考卷</button>
        </form>
      ) : null}

      {report.remediationExams.length ? (
        <section className="mt-8">
          <h2 className="text-xl font-black text-ink">薄弱点改善结果</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {report.remediationExams.map((exam) => (
              <SoftCard key={exam.id}>
                <div className="flex items-center justify-between gap-3"><strong className="text-ink">{exam.result?.improved ? "已改善" : "仍需巩固"}</strong><SoftBadge variant={exam.result?.improved ? "brand" : "muted"}>{exam.result?.totalScore}%</SoftBadge></div>
                <p className="mt-2 text-sm text-ink-soft">{exam.result?.categories.map((item) => `${item.category} ${item.accuracy}%`).join(" · ")}</p>
              </SoftCard>
            ))}
          </div>
        </section>
      ) : null}

      {report.summary.completedAttempts === 0 ? (
        <SoftCard className="mt-6 text-sm text-ink-soft">
          暂无已完成的知识测试。进行中的答题不会提前计入报告。
        </SoftCard>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="text-xl font-black text-ink">每日趋势</h2>
            <div className="mt-3 overflow-x-auto rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-soft)]">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="text-ink-faint"><tr><th className="pb-3">日期</th><th>完成</th><th>答题</th><th>正确率</th></tr></thead>
                <tbody>{report.trend.map((item) => (
                  <tr className="border-t border-border-soft" key={item.date}>
                    <td className="py-3 font-bold text-ink">{item.date}</td><td>{item.completedAttempts} 次</td><td>{item.answeredCount} 题</td><td>{item.accuracy}%</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-black text-ink">薄弱分类（前 5 项）</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {report.categories.slice(0, 5).map((category) => (
                <SoftCard key={category.category}>
                  <h3 className="font-black text-ink">{category.category}</h3>
                  <p className="mt-2 text-sm text-ink-soft">答题 {category.answeredCount} · 错题 {category.wrongCount} · 错误率 {category.errorRate}%</p>
                  <p className="mt-1 text-xs text-ink-faint">最近错误：{category.latestWrongAt ? dateTime.format(new Date(category.latestWrongAt)) : "本期无错题"}</p>
                </SoftCard>
              ))}
            </div>
          </section>

          <section className="mt-8 pb-10">
            <h2 className="text-xl font-black text-ink">错题证据</h2>
            <p className="mt-1 text-sm text-ink-soft">同一稳定题号错误至少 2 次标为高频；历史内容来自当时绑定的题目版本。</p>
            <div className="mt-4 space-y-4">
              {report.questionWeaknesses.slice(0, 5).map((weakness) => (
                <SoftCard key={weakness.stableKey}>
                  <div className="flex flex-wrap items-center gap-2">
                    <SoftBadge variant={weakness.classification === "high_frequency" ? "brand" : "muted"}>
                      {weakness.classification === "high_frequency" ? "高频错点" : "本期错题"}
                    </SoftBadge>
                    <span className="text-xs font-bold text-ink-faint">{weakness.stableKey}</span>
                    <span className="text-xs text-ink-soft">错误 {weakness.wrongCount}/{weakness.answeredCount}</span>
                  </div>
                  <div className="mt-3 space-y-3">
                    {weakness.evidence.map((evidence, index) => (
                      <details className="rounded-2xl bg-surface-muted p-4" key={`${evidence.attemptId}-${evidence.answeredAt}-${index}`} open={index === 0}>
                        <summary className="cursor-pointer text-sm font-bold text-ink">{dateTime.format(new Date(evidence.answeredAt))} · {evidence.source === "legacy" ? "历史专题记录" : "知识测试"}</summary>
                        {evidence.prompt ? (
                          <div className="mt-3 space-y-1 text-sm leading-6 text-ink-soft">
                            <p className="font-bold text-ink">{evidence.prompt}</p>
                            <p>错误选择：{evidence.selectedAnswers.join("、") || "未作答"}</p>
                            <p>正确答案：{evidence.correctAnswers?.join("、")}</p>
                            <p>解析：{evidence.explanation}</p>
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-ink-soft">该旧专题记录无法映射到可追溯题目版本；保留原判定，不展示或伪造题干与答案。</p>
                        )}
                      </details>
                    ))}
                  </div>
                </SoftCard>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <SoftCard><p className="text-xs font-bold text-ink-faint">{label}</p><p className="mt-2 text-2xl font-black text-ink">{value}</p></SoftCard>;
}

function RangePicker({ report, basePath, preservedParams }: { report: LearningQuizReport; basePath: string; preservedParams: Record<string, string> }) {
  const query = new URLSearchParams(preservedParams);
  const hrefFor = (preset: "today" | "last7") => {
    const next = new URLSearchParams(query); next.set("preset", preset); next.delete("start"); next.delete("end");
    return `${basePath}?${next.toString()}`;
  };
  return (
    <section className="mt-6 rounded-[var(--radius-card)] bg-surface-muted p-4">
      <div className="flex flex-wrap gap-2">
        <Link className="rounded-full bg-surface px-4 py-2 text-sm font-bold text-ink" href={hrefFor("today")}>今日</Link>
        <Link className="rounded-full bg-surface px-4 py-2 text-sm font-bold text-ink" href={hrefFor("last7")}>近 7 天</Link>
      </div>
      <form className="mt-3 flex flex-wrap items-end gap-3" action={basePath} method="get">
        {Object.entries(preservedParams).map(([name, value]) => <input key={name} name={name} type="hidden" value={value} />)}
        <input name="preset" type="hidden" value="custom" />
        <DateField label="开始日期" name="start" value={report.range.startDate} />
        <DateField label="结束日期" name="end" value={report.range.endDate} />
        <button className="min-h-10 rounded-[var(--radius-control)] bg-ink px-4 text-sm font-bold text-white" type="submit">查看</button>
      </form>
    </section>
  );
}

function DateField({ label, name, value }: { label: string; name: string; value: string }) {
  return <label className="text-xs font-bold text-ink-soft">{label}<input className="mt-1 block min-h-10 rounded-xl border border-border-soft bg-surface px-3 text-sm text-ink" defaultValue={value} name={name} required type="date" /></label>;
}
