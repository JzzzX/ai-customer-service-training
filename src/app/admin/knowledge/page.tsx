import { PageHeader } from "@/components/ui/page-header";
import { SoftBadge } from "@/components/ui/soft-badge";
import { SoftCard } from "@/components/ui/soft-card";
import { requireAdmin } from "@/lib/auth/guards";
import { getKnowledgeQueryStore } from "@/lib/runtime/services";

export default async function AdminKnowledgePage() {
  await requireAdmin();
  const health = await getKnowledgeQueryStore().loadActiveHealth();

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          backHref="/admin"
          description="查看生产数据库中已发布知识快照的健康度与版本信息。"
          label="知识根基"
          title="知识库状态"
        />

        {health ? (
          <div className="mt-10 animate-fade-in-up space-y-6">
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "来源文件", value: health.sourceCount },
                { label: "知识单元", value: health.unitCount },
                { label: "待处理冲突", value: health.conflictCount },
                { label: "题目草稿", value: health.questionCount },
              ].map((metric, index) => (
                <SoftCard
                  className="animate-fade-in-up"
                  hover
                  key={metric.label}
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <p className="text-sm font-bold text-ink-soft">
                    {metric.label}
                  </p>
                  <p className="mt-2 text-3xl font-black text-ink">
                    {metric.value}
                  </p>
                </SoftCard>
              ))}
            </section>

            <SoftCard className="animate-fade-in-up stagger-3" gradient>
              <h2 className="font-black text-ink">{health.sourceRoot}</h2>
              <p className="mt-2 break-all text-sm leading-6 text-ink-soft">
                活跃版本 {health.versionHash.slice(0, 12)} · 正式题组{" "}
                {health.publishedQuizCount} · 已发布场景{" "}
                {health.publishedScenarioCount}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <SoftBadge variant="warning">只读快照</SoftBadge>
                <p className="text-sm font-bold text-warning">
                  本页只展示生产数据库中的已发布快照，不会从网页实时读取本地文档。
                </p>
              </div>
            </SoftCard>
          </div>
        ) : (
          <SoftCard className="mt-10 animate-fade-in-up">
            <p className="text-ink-soft">当前运行模式没有可用的活跃知识版本。</p>
          </SoftCard>
        )}
      </div>
    </main>
  );
}
