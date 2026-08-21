import Link from "next/link";

import { SoftBadge } from "@/components/ui/soft-badge";
import { SoftCard } from "@/components/ui/soft-card";
import { requireAdmin } from "@/lib/auth/guards";

export default async function AdminPage() {
  const admin = await requireAdmin();
  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <SoftBadge variant="brand">管理员</SoftBadge>
        <h1 className="mt-3 text-3xl font-black text-ink">你好，{admin.name}</h1>
        <p className="mt-2 text-ink-soft">管理已发布知识题目；管理员账号不能参与练习。</p>
        <section className="mt-10 grid gap-4 md:grid-cols-2">
          <SoftCard gradient>
            <h2 className="text-xl font-black text-ink">题库修订</h2>
            <p className="mt-2 text-sm leading-6 text-ink-soft">查看稳定题号和修订历史，复制当前版本为草稿并审核发布。</p>
            <Link className="mt-6 inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-ink px-5 font-bold text-white" href="/admin/questions">
              进入题库管理
            </Link>
          </SoftCard>
          <SoftCard gradient>
            <h2 className="text-xl font-black text-ink">学员知识报告</h2>
            <p className="mt-2 text-sm leading-6 text-ink-soft">按姓名或邮箱查看学员的知识测试薄弱点；情景实战报告保持独立。</p>
            <Link className="mt-6 inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-ink px-5 font-bold text-white" href="/admin/reports">
              查看学员报告
            </Link>
          </SoftCard>
        </section>
      </div>
    </main>
  );
}
