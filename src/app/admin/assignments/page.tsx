import { PageHeader } from "@/components/ui/page-header";
import { SoftBadge } from "@/components/ui/soft-badge";
import { SoftButton } from "@/components/ui/soft-button";
import { SoftCard } from "@/components/ui/soft-card";
import { requireAdmin } from "@/lib/auth/guards";
import {
  getAssignmentService,
  getTrainingCatalogStore,
} from "@/lib/runtime/services";

import { createAssignmentAction } from "./actions";

const inputClassName =
  "mt-2 min-h-12 w-full rounded-[var(--radius-control)] border-2 border-surface-muted bg-surface px-3 text-ink outline-none transition-colors focus:border-scenario disabled:opacity-50";

export default async function AdminAssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  await requireAdmin();
  const [learners, targets, assignments] = await Promise.all([
    getTrainingCatalogStore().listLearners(),
    getTrainingCatalogStore().listTargets(),
    getAssignmentService().listForAdmin(),
  ]);
  const params = await searchParams;
  const canCreate = learners.length > 0 && targets.length > 0;

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          backHref="/admin"
          description="向客服新人下发小测或情景实战，并查看已下发任务状态。"
          label="训练任务"
          title="下发与跟进"
        />

        {params.created === "1" ? (
          <SoftCard className="mt-8 animate-fade-in-up" gradient>
            <div className="flex flex-wrap items-center gap-2">
              <SoftBadge variant="success">已下发</SoftBadge>
              <p className="text-sm font-bold text-success">
                训练任务已下发。
              </p>
            </div>
          </SoftCard>
        ) : null}

        <SoftCard className="mt-8 animate-fade-in-up">
          <form
            action={createAssignmentAction}
            className="grid gap-4 md:grid-cols-3"
          >
            <label className="text-sm font-bold text-ink-soft">
              学员
              <select
                className={inputClassName}
                disabled={!canCreate}
                name="learnerId"
                required
              >
                {learners.map((learner) => (
                  <option key={learner.id} value={learner.id}>
                    {learner.name} · {learner.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold text-ink-soft">
              训练内容
              <select
                className={inputClassName}
                disabled={!canCreate}
                name="target"
                required
              >
                {targets.map((target) => (
                  <option
                    key={`${target.type}:${target.id}`}
                    value={`${target.type}:${target.id}`}
                  >
                    {target.type === "quiz" ? "小测" : "场景"} · {target.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold text-ink-soft">
              截止时间（可选）
              <input
                className={inputClassName}
                name="dueAt"
                type="datetime-local"
              />
            </label>
            <SoftButton
              className="md:col-span-3"
              disabled={!canCreate}
              type="submit"
              variant="scenario"
            >
              {canCreate ? "下发任务" : "生产内容发布后可下发"}
            </SoftButton>
          </form>
        </SoftCard>

        <AssignmentList assignments={assignments} />
      </div>
    </main>
  );
}

function AssignmentList({
  assignments,
}: {
  assignments: Awaited<
    ReturnType<ReturnType<typeof getAssignmentService>["listForAdmin"]>
  >;
}) {
  const statusVariant: Record<
    (typeof assignments)[number]["status"],
    "warning" | "scenario" | "success"
  > = {
    assigned: "warning",
    in_progress: "scenario",
    completed: "success",
  };

  return (
    <section className="mt-8 space-y-3">
      {assignments.map((assignment, index) => (
        <SoftCard
          className="animate-fade-in-up flex flex-wrap items-center justify-between gap-4"
          hover
          key={assignment.id}
          style={{ animationDelay: `${index * 60}ms` }}
        >
          <div>
            <p className="font-black text-ink">
              {assignment.learnerName} · {assignment.targetLabel}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              {assignment.assignmentType === "quiz" ? "知识小测" : "情景实战"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SoftBadge variant={statusVariant[assignment.status]}>
              {statusLabel(assignment.status)}
            </SoftBadge>
            <SoftBadge variant="muted">
              {assignment.dueAt
                ? `截止 ${new Date(assignment.dueAt).toLocaleString("zh-CN")}`
                : "无截止时间"}
            </SoftBadge>
          </div>
        </SoftCard>
      ))}
      {assignments.length === 0 ? (
        <SoftCard className="animate-fade-in-up">
          <p className="text-ink-soft">暂无训练任务。</p>
        </SoftCard>
      ) : null}
    </section>
  );
}

function statusLabel(status: "assigned" | "in_progress" | "completed") {
  return {
    assigned: "待开始",
    in_progress: "进行中",
    completed: "已完成",
  }[status];
}
