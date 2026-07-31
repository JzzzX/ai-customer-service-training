import { PageHeader } from "@/components/ui/page-header";
import { SoftBadge } from "@/components/ui/soft-badge";
import { SoftButtonLink } from "@/components/ui/soft-button";
import { SoftCard } from "@/components/ui/soft-card";
import { requireUser } from "@/lib/auth/guards";
import { getAssignmentService } from "@/lib/runtime/services";

const statusLabels: Record<string, string> = {
  assigned: "待开始",
  in_progress: "进行中",
  completed: "已完成",
};

const statusVariants: Record<string, "warning" | "scenario" | "success"> = {
  assigned: "warning",
  in_progress: "scenario",
  completed: "success",
};

export default async function PracticeAssignmentsPage() {
  const user = await requireUser();
  const assignments =
    await getAssignmentService().listForLearner(user.id);

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          backHref="/practice"
          label="我的任务"
          title="待完成训练"
        />

        <section className="mt-10 space-y-4 animate-fade-in-up stagger-1">
          {assignments.map((assignment) => (
            <SoftCard
              className="flex flex-wrap items-center justify-between gap-5"
              key={assignment.id}
            >
              <div>
                <SoftBadge
                  variant={
                    assignment.assignmentType === "quiz" ? "brand" : "scenario"
                  }
                >
                  {assignment.assignmentType === "quiz" ? "知识小测" : "情景实战"}
                </SoftBadge>
                <h2 className="mt-2 text-lg font-black text-ink">
                  {assignment.targetLabel}
                </h2>
                <p className="mt-1 text-sm text-ink-soft">
                  {assignment.status === "completed"
                    ? "已完成"
                    : assignment.dueAt
                      ? `截止 ${new Date(assignment.dueAt).toLocaleString("zh-CN")}`
                      : "无截止时间"}
                </p>
              </div>
              {assignment.status !== "completed" ? (
                <SoftButtonLink
                  href={assignment.launchHref}
                  variant="primary"
                >
                  {assignment.status === "in_progress"
                    ? "继续训练"
                    : "开始训练"}
                </SoftButtonLink>
              ) : (
                <SoftBadge variant={statusVariants[assignment.status]}>
                  {statusLabels[assignment.status]}
                </SoftBadge>
              )}
            </SoftCard>
          ))}
          {assignments.length === 0 ? (
            <SoftCard className="text-center" gradient>
              <p className="text-ink-soft">
                暂无管理员下发的训练任务，你仍可自由练习。
              </p>
              <div className="mt-5 flex justify-center gap-3">
                <SoftButtonLink href="/practice/quiz/topics" variant="secondary">
                  知识小测
                </SoftButtonLink>
                <SoftButtonLink href="/practice/scenario" variant="scenario">
                  情景实战
                </SoftButtonLink>
              </div>
            </SoftCard>
          ) : null}
        </section>
      </div>
    </main>
  );
}
