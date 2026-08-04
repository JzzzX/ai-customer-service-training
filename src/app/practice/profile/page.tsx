import Link from "next/link";

import { SignOutButton } from "@/components/sign-out-button";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress-bar";
import { SoftBadge } from "@/components/ui/soft-badge";
import { SoftButtonLink } from "@/components/ui/soft-button";
import { SoftCard } from "@/components/ui/soft-card";
import { requireUser } from "@/lib/auth/guards";
import { getQuizProgressForLearner } from "@/lib/quiz/attempt-service";
import { quizTopics } from "@/lib/quiz/question-bank";
import {
  getAssignmentService,
  getScenarioTemplateStore,
  getScenarioTrainingService,
} from "@/lib/runtime/services";

type ProfileTab = "tasks" | "quiz" | "scenario";

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Shanghai",
});

const categoryLabels: Record<string, string> = {
  presale: "售前",
  logistics: "物流",
  damage_shortage: "破损少货",
  complaint: "客诉",
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
} = {}) {
  const user = await requireUser();
  const params = await searchParams;
  const tab = parseTab(params?.tab);
  const scenarioTemplates =
    await getScenarioTemplateStore().listPublished();
  const [quizProgress, scenarioProgress] = await Promise.all([
    getQuizProgressForLearner(user.id, {
      recentLimit: tab === "quiz" ? 20 : 0,
    }),
    getScenarioTrainingService().getProgress({
      learnerId: user.id,
      publishedScenarioCount: scenarioTemplates.length,
      publishedScenarioIds: scenarioTemplates.map((scenario) => scenario.id),
      includeDetails: tab === "scenario",
    }),
  ]);
  const assignments =
    tab === "tasks"
      ? await getAssignmentService().listForLearner(user.id)
      : [];

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          action={<SignOutButton />}
          backHref="/practice"
          description="任务、知识小测和情景实战记录都在这里。"
          label="训练中心"
          title="个人中心"
        />

        <section className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] bg-surface-muted px-5 py-4 animate-fade-in-up">
          <div>
            <p className="text-xs font-bold text-ink-faint">当前账号</p>
            <p className="mt-1 font-black text-ink">{user.name}</p>
          </div>
          <div className="text-left text-sm text-ink-soft sm:text-right">
            <p>{user.email}</p>
            <p className="mt-1 text-xs text-ink-faint">
              {user.role === "admin" ? "管理员" : "学员"}
            </p>
          </div>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 animate-fade-in-up">
          <ProgressSummaryCard
            label="知识覆盖"
            value={`${quizProgress.uniqueAnsweredCount} / ${quizProgress.totalQuestions} 题`}
            detail={`累计正确率 ${quizProgress.accuracy}% · ${quizProgress.attemptCount} 次测验`}
            progress={quizProgress.uniqueAnsweredCount}
            max={quizProgress.totalQuestions}
            href="/practice/profile?tab=quiz"
            color="brand"
          />
          <ProgressSummaryCard
            label="实战覆盖"
            value={`${scenarioProgress.completedScenarioCount} / ${scenarioProgress.publishedScenarioCount} 个场景`}
            detail={`最近平均 ${scenarioProgress.recentAverageScore} 分 · ${scenarioProgress.completedSessionCount} 次实战`}
            progress={scenarioProgress.completedScenarioCount}
            max={scenarioProgress.publishedScenarioCount}
            href="/practice/profile?tab=scenario"
            color="scenario"
          />
        </section>

        <nav
          aria-label="个人中心栏目"
          className="mt-8 flex gap-1 overflow-x-auto rounded-[var(--radius-card)] bg-surface-muted p-1"
        >
          <ProfileTabLink active={tab === "tasks"} href="/practice/profile?tab=tasks">
            我的任务
          </ProfileTabLink>
          <ProfileTabLink active={tab === "quiz"} href="/practice/profile?tab=quiz">
            知识记录
          </ProfileTabLink>
          <ProfileTabLink
            active={tab === "scenario"}
            href="/practice/profile?tab=scenario"
          >
            实战记录
          </ProfileTabLink>
        </nav>

        {tab === "tasks" ? <TaskPanel assignments={assignments} /> : null}
        {tab === "quiz" ? <QuizPanel progress={quizProgress} /> : null}
        {tab === "scenario" ? (
          <ScenarioPanel progress={scenarioProgress} />
        ) : null}
      </div>
    </main>
  );
}

function parseTab(input: string | undefined): ProfileTab {
  return input === "quiz" || input === "scenario" ? input : "tasks";
}

function ProgressSummaryCard({
  label,
  value,
  detail,
  progress,
  max,
  href,
  color,
}: {
  label: string;
  value: string;
  detail: string;
  progress: number;
  max: number;
  href: string;
  color: "brand" | "scenario";
}) {
  return (
    <SoftCard gradient>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-ink-faint">{label}</p>
          <p className="mt-2 text-xl font-black text-ink">{value}</p>
        </div>
        <Link
          className="text-sm font-bold text-ink-soft hover:text-ink"
          href={href}
        >
          查看
        </Link>
      </div>
      <ProgressBar
        className="mt-4"
        color={color}
        value={progress}
        max={Math.max(max, 1)}
      />
      <p className="mt-2 text-xs text-ink-soft">{detail}</p>
    </SoftCard>
  );
}

function ProfileTabLink({
  active,
  children,
  href,
}: {
  active: boolean;
  children: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`min-h-11 flex-1 whitespace-nowrap rounded-[var(--radius-control)] px-4 py-2.5 text-center text-sm font-bold transition-colors ${
        active
          ? "bg-surface text-ink shadow-[var(--shadow-soft)]"
          : "text-ink-soft hover:text-ink"
      }`}
      href={href}
    >
      {children}
    </Link>
  );
}

function TaskPanel({
  assignments,
}: {
  assignments: Awaited<
    ReturnType<ReturnType<typeof getAssignmentService>["listForLearner"]>
  >;
}) {
  return (
    <section className="mt-8 animate-fade-in-up">
      <SectionHeading
        title="我的任务"
        description="管理员下发的训练任务与当前状态。"
      />
      <div className="mt-4 space-y-4">
        {assignments.map((assignment) => (
          <SoftCard
            className="flex flex-wrap items-center justify-between gap-5"
            key={assignment.id}
          >
            <div>
              <SoftBadge
                variant={
                  assignment.assignmentType === "quiz" ? "brand" : "scenario"
                }
              >
                {assignment.assignmentType === "quiz" ? "知识小测" : "情景实战"}
              </SoftBadge>
              <h2 className="mt-2 text-lg font-black text-ink">
                {assignment.targetLabel}
              </h2>
              <p className="mt-1 text-sm text-ink-soft">
                {assignment.status === "completed"
                  ? "已完成"
                  : assignment.dueAt
                    ? `截止 ${dateTimeFormatter.format(new Date(assignment.dueAt))}`
                    : "无截止时间"}
              </p>
            </div>
            {assignment.status !== "completed" ? (
              <SoftButtonLink href={assignment.launchHref} variant="primary">
                {assignment.status === "in_progress" ? "继续训练" : "开始训练"}
              </SoftButtonLink>
            ) : (
              <SoftBadge variant="success">已完成</SoftBadge>
            )}
          </SoftCard>
        ))}
        {assignments.length === 0 ? (
          <SoftCard className="text-center" gradient>
            <p className="font-black text-ink">暂无管理员下发的训练任务</p>
            <p className="mt-2 text-sm text-ink-soft">
              你仍然可以自由练习知识小测和情景实战。
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <SoftButtonLink href="/practice/quiz/topics" variant="secondary">
                知识小测
              </SoftButtonLink>
              <SoftButtonLink href="/practice/scenario" variant="scenario">
                情景实战
              </SoftButtonLink>
            </div>
          </SoftCard>
        ) : null}
      </div>
    </section>
  );
}

function QuizPanel({
  progress,
}: {
  progress: Awaited<ReturnType<typeof getQuizProgressForLearner>>;
}) {
  return (
    <section className="mt-8 space-y-9 animate-fade-in-up">
      <div>
        <SectionHeading
          title="专题进度"
          description="按去重后的已答题数计算覆盖率，重复练习不会虚增进度。"
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {progress.topics.map((topicProgress) => {
            const topic = quizTopics.find(
              (candidate) => candidate.id === topicProgress.topicId,
            );
            if (!topic) {
              return null;
            }
            return (
              <SoftCard key={topic.id} hover>
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-2xl bg-brand-soft text-2xl">
                    {topic.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-black text-ink">{topic.label}</h3>
                    <p className="text-xs text-ink-faint">
                      {topicProgress.attemptCount > 0
                        ? `练习 ${topicProgress.attemptCount} 次 · 正确率 ${topicProgress.accuracy}%`
                        : "还未开始"}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-black text-brand">
                    {topicProgress.uniqueAnsweredCount} / {topicProgress.totalQuestions}
                  </p>
                </div>
                <ProgressBar
                  className="mt-4"
                  value={topicProgress.uniqueAnsweredCount}
                  max={Math.max(topicProgress.totalQuestions, 1)}
                />
              </SoftCard>
            );
          })}
        </div>
      </div>

      <div>
        <SectionHeading title="最近练习" description="最近 20 次已保存的测验记录。" />
        {progress.recentAttempts.length === 0 ? (
          <EmptyPanel
            className="mt-4"
            title="还没有练习记录"
            actionHref="/practice/quiz/topics"
            actionLabel="选择专题"
          />
        ) : (
          <ul className="mt-4 grid gap-3">
            {progress.recentAttempts.map((attempt) => (
              <li
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] bg-surface px-5 py-4 shadow-[var(--shadow-soft)]"
                key={attempt.id}
              >
                <div>
                  <p className="font-bold text-ink">
                    {attempt.topicId
                      ? quizTopics.find((topic) => topic.id === attempt.topicId)?.label ??
                        "专题练习"
                      : "正式题组"}
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {dateTimeFormatter.format(new Date(attempt.completedAt))}
                    {attempt.newCoverageCount > 0
                      ? ` · 新覆盖 ${attempt.newCoverageCount} 题`
                      : ""}
                  </p>
                </div>
                <p className="text-2xl font-black text-brand">{attempt.score}%</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ScenarioPanel({
  progress,
}: {
  progress: Awaited<
    ReturnType<ReturnType<typeof getScenarioTrainingService>["getProgress"]>
  >;
}) {
  return (
    <section className="mt-8 space-y-9 animate-fade-in-up">
      <div>
        <SectionHeading
          title="进行中的实战"
          description="中途离开的会话会保留在这里，可以继续完成。"
        />
        {progress.activeSessions.length === 0 ? (
          <EmptyPanel
            className="mt-4"
            title="没有进行中的实战"
            actionHref="/practice/scenario"
            actionLabel="开始实战"
          />
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {progress.activeSessions.map((session) => (
              <SoftCard
                className="flex items-center justify-between gap-4"
                key={session.id}
              >
                <div className="min-w-0">
                  <SoftBadge variant="scenario">
                    {categoryLabels[session.category] ?? "情景实战"}
                  </SoftBadge>
                  <p className="mt-2 truncate font-black text-ink">{session.title}</p>
                  <p className="mt-1 text-xs text-ink-faint">
                    已进行 {session.learnerTurnCount} / {session.maxTurns} 轮
                  </p>
                </div>
                <SoftButtonLink
                  href={`/practice/scenario/session/${session.id}`}
                  variant="scenario"
                  size="sm"
                >
                  继续训练
                </SoftButtonLink>
              </SoftCard>
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionHeading title="已完成记录" description="最近 20 次已完成的实战报告。" />
        {progress.completedSessions.length === 0 ? (
          <EmptyPanel
            className="mt-4"
            title="还没有完成的实战记录"
            actionHref="/practice/scenario"
            actionLabel="选择场景"
          />
        ) : (
          <ul className="mt-4 grid gap-3">
            {progress.completedSessions.map((session) => (
              <li
                className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-card)] bg-surface px-5 py-4 shadow-[var(--shadow-soft)]"
                key={session.id}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-ink">{session.title}</p>
                    <SoftBadge
                      variant={session.verdict === "passed" ? "success" : "warning"}
                    >
                      {session.verdict === "passed" ? "通过" : "需要重练"}
                    </SoftBadge>
                  </div>
                  <p className="mt-1 text-xs text-ink-faint">
                    {categoryLabels[session.category] ?? "情景实战"} ·{" "}
                    {session.completedAt
                      ? dateTimeFormatter.format(new Date(session.completedAt))
                      : "已完成"}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-2xl font-black text-scenario-strong">
                    {session.score ?? 0}分
                  </p>
                  <SoftButtonLink
                    href={`/practice/scenario/report/${session.id}`}
                    variant="secondary"
                    size="sm"
                  >
                    查看完整报告
                  </SoftButtonLink>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-xl font-black text-ink">{title}</h2>
      <p className="mt-1 text-sm text-ink-faint">{description}</p>
    </div>
  );
}

function EmptyPanel({
  title,
  actionHref,
  actionLabel,
  className = "",
}: {
  title: string;
  actionHref: string;
  actionLabel: string;
  className?: string;
}) {
  return (
    <SoftCard className={`text-center ${className}`} gradient>
      <p className="font-black text-ink">{title}</p>
      <SoftButtonLink className="mt-5" href={actionHref} variant="primary">
        {actionLabel}
      </SoftButtonLink>
    </SoftCard>
  );
}
