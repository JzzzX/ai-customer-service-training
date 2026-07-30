import Link from "next/link";

import { SignOutButton } from "@/components/sign-out-button";
import { requireAdmin } from "@/lib/auth/guards";

export default async function AdminPage() {
  const user = await requireAdmin();

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#5c7cdb]">培训管理</p>
            <h1 className="mt-1 text-2xl font-black text-[#21312a]">
              管理员控制台
            </h1>
          </div>
          <SignOutButton />
        </header>

        <section className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "知识库状态",
              description: "检查生产知识快照、冲突与发布覆盖。",
              href: "/admin/knowledge",
              action: "查看根基",
            },
            {
              title: "题库管理",
              description: "审核40道知识题，全部通过后发布给学员。",
              href: "/admin/questions",
              action: "开始审题",
            },
            {
              title: "场景管理",
              description: "查看8个已发布文字场景及知识依据。",
              href: "/admin/scenarios",
              action: "查看场景",
            },
            {
              title: "训练任务",
              description: "向客服新人下发小测或情景实战。",
              href: "/admin/assignments",
              action: "下发任务",
            },
            {
              title: "学习记录",
              description: "按学员查看任务状态与完成记录。",
              href: "/admin/history",
              action: "查看记录",
            },
            {
              title: "人工复核",
              description: "处理低分、风险与抽样训练报告。",
              href: "/admin/reviews",
              action: "查看队列",
            },
          ].map((item) => (
            <article
              className="rounded-[24px] border-2 border-[#dde4ef] bg-white p-6"
              key={item.title}
            >
              <h2 className="text-xl font-black text-[#21312a]">
                {item.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#68786f]">
                {item.description}
              </p>
              {item.href ? (
                <Link
                  className="mt-5 inline-flex font-bold text-[#5c7cdb]"
                  href={item.href}
                >
                  {item.action}
                </Link>
              ) : null}
            </article>
          ))}
        </section>

        <p className="mt-8 text-sm text-[#7a8981]">
          当前账号：{user.email}
        </p>
        <Link
          className="mt-4 inline-flex font-bold text-[#399a57]"
          href="/practice"
        >
          返回训练中心
        </Link>
      </div>
    </main>
  );
}
