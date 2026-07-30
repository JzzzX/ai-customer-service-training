import Link from "next/link";

import { requireAdmin } from "@/lib/auth/guards";
import {
  getAssignmentService,
  getTrainingCatalogStore,
} from "@/lib/runtime/services";

import { createAssignmentAction } from "./actions";

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
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#5c7cdb]">训练任务</p>
            <h1 className="mt-1 text-2xl font-black text-[#21312a]">
              下发与跟进
            </h1>
          </div>
          <Link className="font-bold text-[#65756d]" href="/admin">
            返回
          </Link>
        </header>
        {params.created === "1" ? (
          <p className="mt-6 rounded-2xl bg-[#eff9f1] p-4 font-bold text-[#2f7b46]">
            训练任务已下发。
          </p>
        ) : null}
        <form
          action={createAssignmentAction}
          className="mt-6 grid gap-4 rounded-[24px] border-2 border-[#dde4ef] bg-white p-6 md:grid-cols-3"
        >
          <label className="text-sm font-bold text-[#33443b]">
            学员
            <select
              className="mt-2 min-h-12 w-full rounded-xl border-2 border-[#dfe5e1] px-3"
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
          <label className="text-sm font-bold text-[#33443b]">
            训练内容
            <select
              className="mt-2 min-h-12 w-full rounded-xl border-2 border-[#dfe5e1] px-3"
              disabled={!canCreate}
              name="target"
              required
            >
              {targets.map((target) => (
                <option
                  key={`${target.type}:${target.id}`}
                  value={`${target.type}:${target.id}`}
                >
                  {target.type === "quiz" ? "小测" : "场景"} ·{" "}
                  {target.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold text-[#33443b]">
            截止时间（可选）
            <input
              className="mt-2 min-h-12 w-full rounded-xl border-2 border-[#dfe5e1] px-3"
              name="dueAt"
              type="datetime-local"
            />
          </label>
          <button
            className="min-h-12 rounded-2xl bg-[#6c8bea] px-5 font-black text-white disabled:bg-[#b9c1d7] md:col-span-3"
            disabled={!canCreate}
            type="submit"
          >
            {canCreate ? "下发任务" : "生产内容发布后可下发"}
          </button>
        </form>
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
  return (
    <section className="mt-8 space-y-3">
      {assignments.map((assignment) => (
        <article
          className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-[#e2e7e4] bg-white p-5"
          key={assignment.id}
        >
          <div>
            <p className="font-black text-[#21312a]">
              {assignment.learnerName} · {assignment.targetLabel}
            </p>
            <p className="mt-1 text-sm text-[#68786f]">
              {assignment.assignmentType === "quiz" ? "知识小测" : "情景实战"}{" "}
              · {statusLabel(assignment.status)}
            </p>
          </div>
          <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-bold text-[#5c7cdb]">
            {assignment.dueAt
              ? `截止 ${new Date(assignment.dueAt).toLocaleString("zh-CN")}`
              : "无截止时间"}
          </span>
        </article>
      ))}
      {assignments.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-[#68786f]">
          暂无训练任务。
        </p>
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
