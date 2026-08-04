import { PageHeader } from "@/components/ui/page-header";
import { SoftBadge } from "@/components/ui/soft-badge";
import { SoftCard } from "@/components/ui/soft-card";
import { requireAdmin } from "@/lib/auth/guards";
import { getAssignmentService } from "@/lib/runtime/services";

export default async function AdminHistoryPage() {
  await requireAdmin();
  const assignments = await getAssignmentService().listForAdmin();

  const statusVariant: Record<
    (typeof assignments)[number]["status"],
    "warning" | "scenario" | "success"
  > = {
    assigned: "warning",
    in_progress: "scenario",
    completed: "success",
  };

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          backHref="/admin"
          description="按学员查看任务状态与完成记录。"
          label="学习记录"
          title="任务完成概览"
        />

        <SoftCard className="mt-10 animate-fade-in-up p-0">
          {assignments.map((item, index) => (
            <div
              className="grid gap-2 border-b border-surface-muted p-5 last:border-b-0 sm:grid-cols-3"
              key={item.id}
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <strong className="text-ink">{item.learnerName}</strong>
              <span className="text-ink-soft">{item.targetLabel}</span>
              <SoftBadge
                className="w-fit"
                variant={statusVariant[item.status]}
              >
                {item.status}
              </SoftBadge>
            </div>
          ))}
          {assignments.length === 0 ? (
            <p className="p-6 text-ink-soft">暂无可展示记录。</p>
          ) : null}
        </SoftCard>
      </div>
    </main>
  );
}
