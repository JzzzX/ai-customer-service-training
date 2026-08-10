import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { SoftBadge } from "@/components/ui/soft-badge";
import { SoftCard } from "@/components/ui/soft-card";
import { requireAdmin } from "@/lib/auth/guards";
import { getReviewService } from "@/lib/runtime/services";

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ reviewed?: string }>;
}) {
  await requireAdmin();
  const [items, params] = await Promise.all([
    getReviewService().listPending(),
    searchParams,
  ]);

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          backHref="/admin"
          description="处理低分、风险与抽样训练报告。"
          label="人工复核"
          title="待复核报告"
        />

        {params.reviewed === "1" ? (
          <SoftCard className="mt-8 animate-fade-in-up" gradient>
            <div className="flex flex-wrap items-center gap-2">
              <SoftBadge variant="success">已保存</SoftBadge>
              <p className="text-sm font-bold text-success">
                复核结论已保存，原始报告仍保留。
              </p>
            </div>
          </SoftCard>
        ) : null}

        <section className="mt-8 space-y-3">
          {items.map((item, index) => (
            <Link
              className="block animate-fade-in-up"
              href={`/admin/reviews/${item.reportId}`}
              key={item.reportId}
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <SoftCard className="flex items-center justify-between gap-4" hover>
                <div>
                  <h2 className="font-black text-ink">
                    {item.learnerName} · {item.scenarioTitle}
                  </h2>
                  <p className="mt-1 text-sm text-ink-soft">
                    原始分 {item.totalScore} · {item.reviewTrigger}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-scenario-strong">
                  去复核 →
                </span>
              </SoftCard>
            </Link>
          ))}
          {items.length === 0 ? (
            <SoftCard className="animate-fade-in-up">
              <p className="text-ink-soft">当前没有待复核报告。</p>
            </SoftCard>
          ) : null}
        </section>
      </div>
    </main>
  );
}
