import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/guards";
import { getReviewService } from "@/lib/runtime/services";

import { decideReviewAction } from "../actions";

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
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#5c7cdb]">报告复核</p>
            <h1 className="mt-1 text-2xl font-black text-[#21312a]">
              {item.learnerName} · {item.scenarioTitle}
            </h1>
          </div>
          <Link className="font-bold text-[#65756d]" href="/admin/reviews">
            返回
          </Link>
        </header>
        <section className="mt-8 rounded-[24px] border-2 border-[#dde4ef] bg-white p-6">
          <h2 className="font-black">原始模拟报告：{item.totalScore} 分</h2>
          <p className="mt-2 text-sm text-[#68786f]">
            结论 {item.verdict} · 置信度{" "}
            {Math.round(item.confidence * 100)}%
          </p>
          <div className="mt-5 space-y-3">
            {item.transcript.map((message, index) => (
              <p
                className="rounded-xl bg-[#f5f7fa] p-4 text-sm leading-6"
                key={`${message.createdAt}-${index}`}
              >
                <strong>
                  {message.role === "customer" ? "顾客" : "学员"}：
                </strong>
                {message.content}
              </p>
            ))}
          </div>
          <div className="mt-5 rounded-xl bg-[#fff8e9] p-4 text-sm">
            <strong>遗漏：</strong>
            {item.missedSteps.join("；") || "无"}
            <br />
            <strong>建议：</strong>
            {item.recommendations.join("；") || "无"}
          </div>
        </section>
        {item.decision ? (
          <p className="mt-6 rounded-2xl bg-[#eff9f1] p-5 font-bold text-[#2f7b46]">
            已复核：{item.decision.comment}
          </p>
        ) : (
          <form
            action={decideReviewAction}
            className="mt-6 grid gap-4 rounded-[24px] border-2 border-[#dde4ef] bg-white p-6 sm:grid-cols-2"
          >
            <input name="reportId" type="hidden" value={item.reportId} />
            <label className="text-sm font-bold">
              复核结论
              <select
                className="mt-2 min-h-12 w-full rounded-xl border-2 border-[#dfe5e1] px-3"
                name="status"
              >
                <option value="confirmed">确认原报告</option>
                <option value="adjusted">调整分数与结论</option>
                <option value="dismissed">忽略本次复核项</option>
              </select>
            </label>
            <label className="text-sm font-bold">
              修正结论（仅“调整”填写）
              <select
                className="mt-2 min-h-12 w-full rounded-xl border-2 border-[#dfe5e1] px-3"
                defaultValue=""
                name="correctedVerdict"
              >
                <option value="">不填写</option>
                <option value="passed">通过</option>
                <option value="needs_retry">需重练</option>
              </select>
            </label>
            <label className="text-sm font-bold">
              修正分数
              <input
                className="mt-2 min-h-12 w-full rounded-xl border-2 border-[#dfe5e1] px-3"
                max="100"
                min="0"
                name="correctedScore"
                type="number"
              />
            </label>
            <label className="text-sm font-bold sm:col-span-2">
              复核说明
              <textarea
                className="mt-2 min-h-28 w-full rounded-xl border-2 border-[#dfe5e1] p-3"
                name="comment"
                required
              />
            </label>
            <button
              className="min-h-12 rounded-2xl bg-[#6c8bea] px-5 font-black text-white sm:col-span-2"
              type="submit"
            >
              保存不可覆盖的复核结论
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
