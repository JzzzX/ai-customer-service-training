import { createAdminQuestionRepository, type AdminQuestionFilters } from "@/db/admin-question-repository";
import { PageHeader } from "@/components/ui/page-header";
import { SoftBadge } from "@/components/ui/soft-badge";
import { SoftCard } from "@/components/ui/soft-card";
import { requireAdmin } from "@/lib/auth/guards";

import {
  createQuestionDraftFromFormAction,
  publishQuestionDraftFromFormAction,
} from "./actions";

type SearchParams = {
  category?: string;
  status?: string;
  stableKey?: string;
  keyword?: string;
};

export default async function AdminQuestionsPage({
  searchParams,
}: { searchParams?: Promise<SearchParams> } = {}) {
  await requireAdmin();
  const params = (await searchParams) ?? {};
  const filters: AdminQuestionFilters = {
    category: clean(params.category),
    status: isQuestionStatus(params.status) ? params.status : undefined,
    stableKey: clean(params.stableKey),
    keyword: clean(params.keyword),
  };
  const records = await createAdminQuestionRepository().list(filters);

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          backHref="/admin"
          badge="管理员"
          description="只修订现有题目。发布新版本不会改变历史作答和历史成绩。"
          label="题库管理"
          title="题库修订"
        />

        <SoftCard className="mt-8" hover={false}>
          <form className="grid gap-4 md:grid-cols-5" method="get">
            <FilterInput defaultValue={filters.category} label="分类" name="category" />
            <label className="text-sm font-bold text-ink-soft">
              状态
              <select className={controlClass} defaultValue={filters.status ?? ""} name="status">
                <option value="">全部</option>
                <option value="published">已发布</option>
                <option value="draft">草稿</option>
                <option value="disabled">已停用</option>
                <option value="archived">已归档</option>
              </select>
            </label>
            <FilterInput defaultValue={filters.stableKey} label="稳定题号" name="stableKey" />
            <FilterInput defaultValue={filters.keyword} label="关键词" name="keyword" />
            <button className="mt-6 min-h-11 rounded-[var(--radius-control)] bg-ink px-5 font-bold text-white" type="submit">
              筛选
            </button>
          </form>
        </SoftCard>

        <section className="mt-6 space-y-5">
          {records.length === 0 ? (
            <SoftCard hover={false}><p className="text-ink-soft">没有符合条件的题目。</p></SoftCard>
          ) : records.map((record) => (
            <SoftCard hover={false} key={record.catalogId}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs font-bold text-ink-faint">{record.stableKey}</p>
                  <h2 className="mt-2 text-xl font-black text-ink">{record.current.prompt}</h2>
                </div>
                <div className="flex gap-2">
                  <SoftBadge variant="brand">{record.current.category}</SoftBadge>
                  <SoftBadge variant="success">当前版本 {record.current.revision}</SoftBadge>
                </div>
              </div>

              <dl className="mt-5 grid gap-3 text-sm md:grid-cols-3">
                <Info label="正确答案" value={record.current.correctAnswers.join("、")} />
                <Info label="难度" value={difficultyLabel(record.current.difficulty)} />
                <Info
                  label="来源"
                  value={record.current.sources.map((source) => `${source.sourcePath} · ${source.anchor}`).join("；")}
                />
              </dl>
              <p className="mt-4 rounded-2xl bg-surface-muted p-4 text-sm leading-6 text-ink-soft">
                {record.current.explanation}
              </p>

              <details className="mt-5 rounded-2xl border border-border-soft p-4">
                <summary className="cursor-pointer font-bold text-ink">创建修订草稿</summary>
                <form action={createQuestionDraftFromFormAction} className="mt-4 grid gap-4">
                  <input name="catalogId" type="hidden" value={record.catalogId} />
                  <input name="baseRevisionId" type="hidden" value={record.current.id} />
                  <EditorField defaultValue={record.current.prompt} label="题干" name="prompt" />
                  <EditorField defaultValue={record.current.options.join("\n")} label="选项（每行一个）" name="options" rows={4} />
                  <EditorField defaultValue={record.current.correctAnswers[0]} label="正确答案" name="correctAnswer" />
                  <EditorField defaultValue={record.current.explanation} label="解析" name="explanation" rows={3} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <EditorField defaultValue={record.current.category} label="分类" name="category" />
                    <label className="text-sm font-bold text-ink-soft">
                      难度
                      <select className={controlClass} defaultValue={record.current.difficulty} name="difficulty">
                        <option value="easy">简单</option>
                        <option value="medium">中等</option>
                        <option value="hard">困难</option>
                      </select>
                    </label>
                  </div>
                  <button className="min-h-11 rounded-[var(--radius-control)] bg-brand px-5 font-bold text-white" type="submit">
                    保存为新草稿
                  </button>
                </form>
              </details>

              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-bold text-ink-soft">完整修订历史（{record.history.length}）</summary>
                <ol className="mt-3 space-y-3">
                  {record.history.map((revision) => (
                    <li className="rounded-2xl bg-surface-muted p-4" key={revision.id}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-bold text-ink">版本 {revision.revision}</p>
                          <p className="mt-1 text-sm text-ink-soft">{revision.prompt}</p>
                        </div>
                        {revision.status === "draft" ? (
                          <form action={publishQuestionDraftFromFormAction}>
                            <input name="catalogId" type="hidden" value={record.catalogId} />
                            <input name="draftRevisionId" type="hidden" value={revision.id} />
                            <input name="expectedCurrentRevisionId" type="hidden" value={record.current.id} />
                            <button className="rounded-[var(--radius-control)] bg-ink px-4 py-2 text-sm font-bold text-white" type="submit">
                              发布此草稿
                            </button>
                          </form>
                        ) : <SoftBadge variant="muted">{revision.status}</SoftBadge>}
                      </div>
                    </li>
                  ))}
                </ol>
              </details>
            </SoftCard>
          ))}
        </section>
      </div>
    </main>
  );
}

const controlClass = "mt-2 min-h-11 w-full rounded-[var(--radius-control)] border border-border-soft bg-surface px-3 text-ink outline-none focus:border-brand";

function clean(value: string | undefined): string | undefined {
  const result = value?.trim();
  return result || undefined;
}

function isQuestionStatus(value: string | undefined): value is NonNullable<AdminQuestionFilters["status"]> {
  return value === "draft" || value === "published" || value === "disabled" || value === "archived";
}

function FilterInput({ defaultValue, label, name }: { defaultValue?: string; label: string; name: string }) {
  return <label className="text-sm font-bold text-ink-soft">{label}<input className={controlClass} defaultValue={defaultValue} name={name} /></label>;
}

function EditorField({ defaultValue, label, name, rows }: { defaultValue?: string; label: string; name: string; rows?: number }) {
  return <label className="text-sm font-bold text-ink-soft">{label}{rows ? <textarea className={controlClass} defaultValue={defaultValue} name={name} rows={rows} /> : <input className={controlClass} defaultValue={defaultValue} name={name} />}</label>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="font-bold text-ink-faint">{label}</dt><dd className="mt-1 text-ink">{value}</dd></div>;
}

function difficultyLabel(value: "easy" | "medium" | "hard") {
  return { easy: "简单", medium: "中等", hard: "困难" }[value];
}
