import Link from "next/link";

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
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#5c7cdb]">人工复核</p>
            <h1 className="mt-1 text-2xl font-black text-[#21312a]">
              待复核报告
            </h1>
          </div>
          <Link className="font-bold text-[#65756d]" href="/admin">
            返回
          </Link>
        </header>
        {params.reviewed === "1" ? (
          <p className="mt-6 rounded-2xl bg-[#eff9f1] p-4 font-bold text-[#2f7b46]">
            复核结论已保存，原始报告仍保留。
          </p>
        ) : null}
        <section className="mt-8 space-y-3">
          {items.map((item) => (
            <Link
              className="flex items-center justify-between gap-4 rounded-2xl border-2 border-[#dde4ef] bg-white p-5"
              href={`/admin/reviews/${item.reportId}`}
              key={item.reportId}
            >
              <div>
                <h2 className="font-black text-[#21312a]">
                  {item.learnerName} · {item.scenarioTitle}
                </h2>
                <p className="mt-1 text-sm text-[#68786f]">
                  原始分 {item.totalScore} · {item.reviewTrigger}
                </p>
              </div>
              <span className="font-bold text-[#5c7cdb]">去复核</span>
            </Link>
          ))}
          {items.length === 0 ? (
            <p className="rounded-2xl bg-white p-6 text-[#68786f]">
              当前没有待复核报告。
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
