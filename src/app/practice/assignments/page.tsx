import Link from "next/link";

import { requireUser } from "@/lib/auth/guards";
import { getAssignmentService } from "@/lib/runtime/services";

export default async function PracticeAssignmentsPage() {
  const user = await requireUser();
  const assignments =
    await getAssignmentService().listForLearner(user.id);

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#399a57]">我的任务</p>
            <h1 className="mt-1 text-2xl font-black text-[#21312a]">
              待完成训练
            </h1>
          </div>
          <Link className="font-bold text-[#65756d]" href="/practice">
            返回
          </Link>
        </header>
        <section className="mt-8 space-y-4">
          {assignments.map((assignment) => (
            <article
              className="flex flex-wrap items-center justify-between gap-5 rounded-[22px] border-2 border-[#dce8df] bg-white p-6"
              key={assignment.id}
            >
              <div>
                <p className="text-xs font-bold text-[#399a57]">
                  {assignment.assignmentType === "quiz"
                    ? "知识小测"
                    : "情景实战"}
                </p>
                <h2 className="mt-1 text-lg font-black text-[#21312a]">
                  {assignment.targetLabel}
                </h2>
                <p className="mt-2 text-sm text-[#68786f]">
                  {assignment.status === "completed"
                    ? "已完成"
                    : assignment.dueAt
                      ? `截止 ${new Date(assignment.dueAt).toLocaleString("zh-CN")}`
                      : "无截止时间"}
                </p>
              </div>
              {assignment.status !== "completed" ? (
                <Link
                  className="rounded-2xl bg-[#65b87a] px-5 py-3 font-black text-white"
                  href={assignment.launchHref}
                >
                  {assignment.status === "in_progress"
                    ? "继续训练"
                    : "开始训练"}
                </Link>
              ) : null}
            </article>
          ))}
          {assignments.length === 0 ? (
            <p className="rounded-2xl bg-white p-6 text-[#68786f]">
              暂无管理员下发的训练任务，你仍可自由练习。
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
