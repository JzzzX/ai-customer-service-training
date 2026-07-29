import Link from "next/link";

import { requireAdmin } from "@/lib/auth/guards";
import {
  loadPublishedQuiz,
  loadQuizReview,
} from "@/lib/quiz/review-service";

import { publishQuizAction } from "./actions";
import { ReviewForm } from "./review-form";

export default async function AdminQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ index?: string; published?: string }>;
}) {
  await requireAdmin();
  const [review, published] = await Promise.all([
    loadQuizReview(),
    loadPublishedQuiz(),
  ]);
  const params = await searchParams;
  const requestedIndex = Number.parseInt(params.index ?? "0", 10);
  const index = Number.isFinite(requestedIndex)
    ? Math.min(Math.max(requestedIndex, 0), review.questions.length - 1)
    : 0;
  const item = review.questions[index]!;
  const approvedCount = review.questions.filter(
    (question) => question.decision === "approved",
  ).length;
  const allApproved = approvedCount === review.questions.length;

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-start justify-between gap-5">
          <div>
            <p className="text-sm font-bold text-[#5c7cdb]">题库管理</p>
            <h1 className="mt-1 text-2xl font-black text-[#21312a]">
              题目审核
            </h1>
            <p className="mt-2 text-sm text-[#68786f]">
              {approvedCount} / {review.questions.length} 已通过
            </p>
          </div>
          <Link className="font-bold text-[#65756d]" href="/admin">
            返回
          </Link>
        </header>

        {params.published === "1" || published ? (
          <p className="mt-6 rounded-2xl border-2 border-[#bfe2c7] bg-[#eff9f1] px-5 py-4 font-bold text-[#2f7b46]">
            正式题组已发布，学员端将优先读取该版本。
          </p>
        ) : null}

        <section className="mt-8 rounded-[28px] border-2 border-[#dde4ef] bg-white p-6 shadow-[0_7px_0_#dde4ef] sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[#5c7cdb]">
                第 {index + 1} / {review.questions.length} 题
              </p>
              <p className="mt-1 text-sm text-[#7a8981]">
                {item.question.type === "single_choice"
                  ? "单选题"
                  : "判断题"}{" "}
                · {item.decision === "approved" ? "已审核" : "待审核"}
              </p>
            </div>
            <nav className="flex gap-3" aria-label="题目翻页">
              <PageLink
                disabled={index === 0}
                href={`/admin/questions?index=${Math.max(index - 1, 0)}`}
                label="上一题"
              />
              <PageLink
                disabled={index === review.questions.length - 1}
                href={`/admin/questions?index=${Math.min(index + 1, review.questions.length - 1)}`}
                label="下一题"
              />
            </nav>
          </div>

          <ReviewForm
            index={index}
            item={item}
            total={review.questions.length}
          />

          <div className="mt-6 rounded-2xl bg-[#f5f7fa] px-4 py-3 text-xs leading-6 text-[#68786f]">
            知识来源：{formatSource(item.question.sources[0])}
          </div>
        </section>

        <section className="mt-8 rounded-[24px] border-2 border-[#dce8df] bg-white p-6">
          <h2 className="text-lg font-black text-[#21312a]">发布正式题组</h2>
          <p className="mt-2 text-sm leading-6 text-[#68786f]">
            40题全部审核通过后才能发布，发布后学员端才会替换演示题。
          </p>
          <form action={publishQuizAction}>
            <button
              className="mt-5 min-h-12 rounded-2xl bg-[#65b87a] px-6 font-black text-white shadow-[0_4px_0_#3f9258] enabled:active:translate-y-1 enabled:active:shadow-none disabled:cursor-not-allowed disabled:bg-[#b9c6bc] disabled:shadow-none"
              disabled={!allApproved}
              type="submit"
            >
              {allApproved ? "发布40题正式题组" : "完成全部审核后可发布"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

function PageLink({
  disabled,
  href,
  label,
}: {
  disabled: boolean;
  href: string;
  label: string;
}) {
  return disabled ? (
    <span className="rounded-xl bg-[#eef1f5] px-3 py-2 text-sm font-bold text-[#a3ada7]">
      {label}
    </span>
  ) : (
    <Link
      className="rounded-xl bg-[#eef2ff] px-3 py-2 text-sm font-bold text-[#5c7cdb]"
      href={href}
    >
      {label}
    </Link>
  );
}

function formatSource(
  source:
    | {
        sourcePath: string;
        anchor: string;
        line?: number;
        sheet?: string;
        row?: number;
      }
    | undefined,
): string {
  if (!source) {
    return "未标注";
  }
  if (source.sheet && source.row) {
    return `${source.sourcePath} · ${source.sheet} 第 ${source.row} 行`;
  }
  if (source.line) {
    return `${source.sourcePath} · 第 ${source.line} 行`;
  }
  return `${source.sourcePath} · ${source.anchor}`;
}
