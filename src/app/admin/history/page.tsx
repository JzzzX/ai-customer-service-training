import Link from "next/link";

import { requireAdmin } from "@/lib/auth/guards";
import { getAssignmentService } from "@/lib/runtime/services";

export default async function AdminHistoryPage() {
  await requireAdmin();
  const assignments = await getAssignmentService().listForAdmin();

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#5c7cdb]">学习记录</p>
            <h1 className="mt-1 text-2xl font-black text-[#21312a]">
              任务完成概览
            </h1>
          </div>
          <Link className="font-bold text-[#65756d]" href="/admin">
            返回
          </Link>
        </header>
        <div className="mt-8 overflow-hidden rounded-[22px] border-2 border-[#dde4ef] bg-white">
          {assignments.map((item) => (
            <div
              className="grid gap-2 border-b border-[#edf0ee] p-5 last:border-b-0 sm:grid-cols-3"
              key={item.id}
            >
              <strong>{item.learnerName}</strong>
              <span>{item.targetLabel}</span>
              <span className="text-[#68786f]">{item.status}</span>
            </div>
          ))}
          {assignments.length === 0 ? (
            <p className="p-6 text-[#68786f]">暂无可展示记录。</p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
