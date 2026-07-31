import { PageHeader } from "@/components/ui/page-header";
import { SoftBadge } from "@/components/ui/soft-badge";
import { SoftButton, SoftButtonLink } from "@/components/ui/soft-button";
import { SoftCard } from "@/components/ui/soft-card";
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
        <PageHeader
          backHref="/admin"
          description={`${approvedCount} / ${review.questions.length} 已通过`}
          label="题库管理"
          title="题目审核"
        />

        {params.published === "1" || published ? (
          <SoftCard className="mt-8 animate-fade-in-up" gradient>
            <div className="flex flex-wrap items-center gap-2">
              <SoftBadge variant="success">已发布</SoftBadge>
              <p className="text-sm font-bold text-success">
                正式题组已发布，学员端将优先读取该版本。
              </p>
            </div>
          </SoftCard>
        ) : null}

        <SoftCard className="mt-8 animate-fade-in-up">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-scenario-strong">
                第 {index + 1} / {review.questions.length} 题
              </p>
              <p className="mt-1 text-sm text-ink-faint">
                {item.question.type === "single_choice"
                  ? "单选题"
                  : "判断题"}{" "}
                ·{" "}
                <SoftBadge
                  className="px-2 py-0.5"
                  variant={
                    item.decision === "approved" ? "success" : "warning"
                  }
                >
                  {item.decision === "approved" ? "已审核" : "待审核"}
                </SoftBadge>
              </p>
            </div>
            <nav aria-label="题目翻页" className="flex gap-3">
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

          <div className="mt-6 rounded-[var(--radius-control)] bg-surface-muted px-4 py-3 text-xs leading-6 text-ink-soft">
            知识来源：{formatSource(item.question.sources[0])}
          </div>
        </SoftCard>

        <SoftCard className="mt-8 animate-fade-in-up stagger-3" gradient>
          <h2 className="text-lg font-black text-ink">发布正式题组</h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            {review.questions.length}题全部审核通过后才能发布，发布后学员端才会替换演示题。
          </p>
          <form action={publishQuizAction}>
            <SoftButton
              className="mt-5"
              disabled={!allApproved}
              type="submit"
              variant={allApproved ? "primary" : "secondary"}
            >
              {allApproved ? "发布正式题组" : "完成全部审核后可发布"}
            </SoftButton>
          </form>
        </SoftCard>
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
    <SoftButton disabled size="sm" variant="secondary">
      {label}
    </SoftButton>
  ) : (
    <SoftButtonLink href={href} size="sm" variant="secondary">
      {label}
    </SoftButtonLink>
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
