import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { SoftBadge } from "@/components/ui/soft-badge";
import { SoftButton } from "@/components/ui/soft-button";
import { SoftCard } from "@/components/ui/soft-card";
import { requireAdmin } from "@/lib/auth/guards";
import { getReviewService } from "@/lib/runtime/services";

import { decideReviewAction } from "../actions";

const inputClassName =
  "mt-2 min-h-12 w-full rounded-[var(--radius-control)] border-2 border-surface-muted bg-surface px-3 text-ink outline-none transition-colors focus:border-scenario";

const textareaClassName =
  "mt-2 min-h-28 w-full rounded-[var(--radius-control)] border-2 border-surface-muted bg-surface p-3 text-ink outline-none transition-colors focus:border-scenario";

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  await requireAdmin();
  const { reportId } = await params;
  const item = await getReviewService().load(reportId);
  if (!item) {
    notFound();
  }

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          backHref="/admin/reviews"
          description={`结论 ${item.verdict} · 置信度 ${Math.round(item.confidence * 100)}%`}
          label="报告复核"
          title={`${item.learnerName} · ${item.scenarioTitle}`}
        />

        <SoftCard className="mt-8 animate-fade-in-up" gradient>
          <div className="flex flex-wrap items-center gap-2">
            <SoftBadge variant={item.totalScore >= 80 ? "success" : "warning"}>
              {item.totalScore >= 80 ? "通过" : "需重练"}
            </SoftBadge>
            <h2 className="font-black text-ink">
              原始模拟报告：{item.totalScore} 分
            </h2>
          </div>

          <div className="mt-6 space-y-3">
            {item.transcript.map((message, index) => (
              <div
                className={`flex ${message.role === "learner" ? "justify-end" : "justify-start"}`}
                key={`${message.createdAt}-${index}`}
              >
                <div
                  className={`max-w-[90%] rounded-[var(--radius-control)] px-4 py-3 text-sm leading-6 sm:max-w-[80%] ${
                    message.role === "learner"
                      ? "bg-scenario text-white"
                      : "bg-surface-muted text-ink-soft"
                  }`}
                >
                  <p className="mb-1 text-xs font-bold opacity-70">
                    {message.role === "customer" ? "顾客" : "学员"}
                  </p>
                  <p>{message.content}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[var(--radius-control)] bg-surface-muted px-4 py-3 text-sm">
            <p className="text-ink-soft">
              <strong className="text-ink">遗漏：</strong>
              {item.missedSteps.join("；") || "无"}
            </p>
            <p className="mt-2 text-ink-soft">
              <strong className="text-ink">建议：</strong>
              {item.recommendations.join("；") || "无"}
            </p>
          </div>
        </SoftCard>

        {item.decision ? (
          <SoftCard className="mt-6 animate-fade-in-up" gradient>
            <div className="flex flex-wrap items-center gap-2">
              <SoftBadge variant="success">已复核</SoftBadge>
              <p className="text-sm font-bold text-success">
                {item.decision.comment}
              </p>
            </div>
          </SoftCard>
        ) : (
          <SoftCard className="mt-6 animate-fade-in-up">
            <form
              action={decideReviewAction}
              className="grid gap-4 sm:grid-cols-2"
            >
              <input name="reportId" type="hidden" value={item.reportId} />
              <label className="text-sm font-bold text-ink-soft">
                复核结论
                <select className={inputClassName} name="status">
                  <option value="confirmed">确认原报告</option>
                  <option value="adjusted">调整分数与结论</option>
                  <option value="dismissed">忽略本次复核项</option>
                </select>
              </label>
              <label className="text-sm font-bold text-ink-soft">
                修正结论（仅“调整”填写）
                <select
                  className={inputClassName}
                  defaultValue=""
                  name="correctedVerdict"
                >
                  <option value="">不填写</option>
                  <option value="passed">通过</option>
                  <option value="needs_retry">需重练</option>
                </select>
              </label>
              <label className="text-sm font-bold text-ink-soft">
                修正分数
                <input
                  className={inputClassName}
                  max="100"
                  min="0"
                  name="correctedScore"
                  type="number"
                />
              </label>
              <label className="text-sm font-bold text-ink-soft sm:col-span-2">
                复核说明
                <textarea
                  className={textareaClassName}
                  name="comment"
                  required
                />
              </label>
              <SoftButton
                className="sm:col-span-2"
                type="submit"
                variant="scenario"
              >
                保存不可覆盖的复核结论
              </SoftButton>
            </form>
          </SoftCard>
        )}
      </div>
    </main>
  );
}
