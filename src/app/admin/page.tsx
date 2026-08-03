import { SignOutButton } from "@/components/sign-out-button";
import { PageHeader } from "@/components/ui/page-header";
import { SoftButtonLink } from "@/components/ui/soft-button";
import { SoftCard } from "@/components/ui/soft-card";
import { requireAdmin } from "@/lib/auth/guards";

const entries = [
  {
    title: "知识库状态",
    description: "检查生产知识快照、冲突与发布覆盖。",
    href: "/admin/knowledge",
    action: "查看根基",
    icon: "📚",
  },
  {
    title: "题库管理",
    description: "审核40道知识题，全部通过后发布给学员。",
    href: "/admin/questions",
    action: "开始审题",
    icon: "📝",
  },
  {
    title: "场景管理",
    description: "查看已发布文字场景及知识依据，也可用 AI 生成新场景。",
    href: "/admin/scenarios",
    action: "查看场景",
    icon: "🎭",
  },
  {
    title: "训练任务",
    description: "向客服新人下发小测或情景实战。",
    href: "/admin/assignments",
    action: "下发任务",
    icon: "📋",
  },
  {
    title: "学习记录",
    description: "按学员查看任务状态与完成记录。",
    href: "/admin/history",
    action: "查看记录",
    icon: "📊",
  },
  {
    title: "人工复核",
    description: "处理低分、风险与抽样训练报告。",
    href: "/admin/reviews",
    action: "查看队列",
    icon: "🔍",
  },
];

export default async function AdminPage() {
  const user = await requireAdmin();

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          action={<SignOutButton />}
          description="管理知识库、题目、场景与训练任务，跟进学员学习进度。"
          label="培训管理"
          title="管理员控制台"
        />

        <section className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry, index) => (
            <SoftCard
              className="animate-fade-in-up flex flex-col"
              gradient
              hover
              key={entry.title}
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <div
                className="flex size-12 items-center justify-center rounded-2xl text-2xl"
                style={{ backgroundColor: "var(--color-admin-soft)" }}
              >
                {entry.icon}
              </div>
              <h2 className="mt-5 text-xl font-black text-ink">
                {entry.title}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-ink-soft">
                {entry.description}
              </p>
              <SoftButtonLink
                className="mt-6 w-full"
                href={entry.href}
                variant="ghost"
              >
                {entry.action}
              </SoftButtonLink>
            </SoftCard>
          ))}
        </section>

        <p className="mt-8 animate-fade-in-up stagger-5 text-sm text-ink-faint">
          当前账号：{user.email}
        </p>
      </div>
    </main>
  );
}
