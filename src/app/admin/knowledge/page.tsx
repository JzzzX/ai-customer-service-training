import Link from "next/link";

import { requireAdmin } from "@/lib/auth/guards";
import { getKnowledgeQueryStore } from "@/lib/runtime/services";

export default async function AdminKnowledgePage() {
  await requireAdmin();
  const health = await getKnowledgeQueryStore().loadActiveHealth();

  return (
    <AdminShell eyebrow="知识根基" title="知识库状态">
      {health ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="来源文件" value={health.sourceCount} />
            <Metric label="知识单元" value={health.unitCount} />
            <Metric label="待处理冲突" value={health.conflictCount} />
            <Metric label="题目草稿" value={health.questionCount} />
          </section>
          <section className="mt-6 rounded-[24px] border-2 border-[#dde4ef] bg-white p-6">
            <h2 className="font-black text-[#21312a]">
              {health.sourceRoot}
            </h2>
            <p className="mt-2 break-all text-sm leading-6 text-[#68786f]">
              活跃版本 {health.versionHash.slice(0, 12)} · 正式题组{" "}
              {health.publishedQuizCount} · 已发布场景{" "}
              {health.publishedScenarioCount}
            </p>
            <p className="mt-3 text-sm font-bold text-[#9a641f]">
              本页只展示生产数据库中的已发布快照，不会从网页实时读取本地文档。
            </p>
          </section>
        </>
      ) : (
        <EmptyState text="当前运行模式没有可用的活跃知识版本。" />
      )}
    </AdminShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-[22px] border-2 border-[#dde4ef] bg-white p-5">
      <p className="text-sm font-bold text-[#68786f]">{label}</p>
      <p className="mt-2 text-3xl font-black text-[#21312a]">{value}</p>
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-2xl bg-white p-6 text-[#68786f]">{text}</p>
  );
}

function AdminShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#5c7cdb]">{eyebrow}</p>
            <h1 className="mt-1 text-2xl font-black text-[#21312a]">
              {title}
            </h1>
          </div>
          <Link className="font-bold text-[#65756d]" href="/admin">
            返回
          </Link>
        </header>
        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}
