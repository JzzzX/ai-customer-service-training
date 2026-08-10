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
type ScenarioStatus = "all" | "active" | "completed";

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Shanghai",
});

const timelineDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "long",
  day: "numeric",
  weekday: "short",
  timeZone: "Asia/Shanghai",
});

const timelineDateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
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
  searchParams?: Promise<{ tab?: string; scenarioStatus?: string }>;
} = {}) {
  const user = await requireUser();
  const params = await searchParams;
  const tab = parseTab(params?.tab);
  const scenarioStatus = parseScenarioStatus(params?.scenarioStatus);
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
          <ScenarioPanel progress={scenarioProgress} status={scenarioStatus} />
        ) : null}
      </div>
    </main>
  );
}

function parseTab(input: string | undefined): ProfileTab {
  return input === "quiz" || input === "scenario" ? input : "tasks";
}

function parseScenarioStatus(input: string | undefined): ScenarioStatus {
  return input === "active" || input === "completed" ? input : "all";
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
  status,
}: {
  progress: Awaited<
    ReturnType<ReturnType<typeof getScenarioTrainingService>["getProgress"]>
  >;
  status: ScenarioStatus;
}) {
  const allSessions = [
    ...progress.activeSessions,
    ...progress.completedSessions,
  ].sort((left, right) => sessionActivityAt(right) - sessionActivityAt(left));
  const filteredSessions = allSessions.filter((session) =>
    status === "all" ? true : session.status === status,
  );
  const groups = Array.from(
    filteredSessions.reduce((grouped, session) => {
      const sessions = grouped.get(session.scenarioId) ?? [];
      sessions.push(session);
      grouped.set(session.scenarioId, sessions);
      return grouped;
    }, new Map<string, typeof allSessions>()),
  )
    .map(([scenarioId, sessions]) => ({ scenarioId, sessions }))
    .sort(
      (left, right) =>
        sessionActivityAt(right.sessions[0]) -
        sessionActivityAt(left.sessions[0]),
    );

  return (
    <section className="mt-8 animate-fade-in-up">
      <SectionHeading
        title="实战时间线"
        description="相同场景已合并，最新会话可直接操作，更早记录按需展开。"
      />
      <nav aria-label="实战记录筛选" className="mt-4 flex gap-2 overflow-x-auto">
        <ScenarioFilterLink
          active={status === "all"}
          count={allSessions.length}
          label="全部"
          status="all"
        />
        <ScenarioFilterLink
          active={status === "active"}
          count={progress.activeSessions.length}
          label="进行中"
          status="active"
        />
        <ScenarioFilterLink
          active={status === "completed"}
          count={progress.completedSessions.length}
          label="已完成"
          status="completed"
        />
      </nav>

      {groups.length === 0 ? (
        <EmptyPanel
          className="mt-4"
          title={status === "active" ? "没有进行中的实战" : "还没有实战记录"}
          actionHref="/practice/scenario"
          actionLabel="开始实战"
        />
      ) : (
        <ol className="mt-6 space-y-5">
          {groups.map((group, index) => {
            const latest = group.sessions[0];
            const currentDate = timelineDateKey(latest);
            const previousDate =
              index > 0 ? timelineDateKey(groups[index - 1].sessions[0]) : null;

            return (
              <li className="relative pl-7 sm:pl-9" key={group.scenarioId}>
                {index < groups.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-[-1.5rem] left-[5px] top-3 w-px bg-scenario/25 sm:left-[7px]"
                  />
                ) : null}
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-2 size-3 rounded-full border-[3px] border-surface bg-scenario shadow-[0_0_0_2px_rgba(138,160,200,0.2)] sm:size-4"
                />
                {currentDate !== previousDate ? (
                  <p className="mb-2 text-sm font-black text-ink-soft">
                    {timelineDateFormatter.format(new Date(sessionDate(latest)))}
                  </p>
                ) : null}
                <ScenarioHistoryCard sessions={group.sessions} />
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function ScenarioFilterLink({
  active,
  count,
  label,
  status,
}: {
  active: boolean;
  count: number;
  label: string;
  status: ScenarioStatus;
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
        active
          ? "bg-scenario text-white"
          : "bg-surface-muted text-ink-soft hover:text-ink"
      }`}
      href={`/practice/profile?tab=scenario&scenarioStatus=${status}`}
    >
      {label} {count}
    </Link>
  );
}

function ScenarioHistoryCard({
  sessions,
}: {
  sessions: Array<
    | Awaited<
        ReturnType<ReturnType<typeof getScenarioTrainingService>["getProgress"]>
      >["activeSessions"][number]
    | Awaited<
        ReturnType<ReturnType<typeof getScenarioTrainingService>["getProgress"]>
      >["completedSessions"][number]
  >;
}) {
  const latest = sessions[0];
  const earlier = sessions.slice(1);

  return (
    <SoftCard className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <SoftBadge variant="scenario">
              {categoryLabels[latest.category] ?? "情景实战"}
            </SoftBadge>
            {sessions.length > 1 ? (
              <span className="text-xs font-bold text-ink-faint">
                共 {sessions.length} 次
              </span>
            ) : null}
          </div>
          <h3 className="mt-2 text-base font-black text-ink sm:text-lg">
            {latest.title}
          </h3>
          <ScenarioSessionMeta session={latest} />
        </div>
        <ScenarioSessionAction latest session={latest} />
      </div>

      {earlier.length > 0 ? (
        <details className="group mt-4 border-t border-scenario/15 pt-3">
          <summary className="cursor-pointer list-none text-sm font-bold text-ink-soft transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="transition-transform group-open:rotate-90">
                ›
              </span>
              展开更早 {earlier.length} 次记录
            </span>
          </summary>
          <ul className="mt-3 divide-y divide-scenario/10 rounded-2xl bg-surface-muted px-4">
            {earlier.map((session) => (
              <li
                className="flex flex-wrap items-center justify-between gap-3 py-3"
                key={session.id}
              >
                <ScenarioSessionMeta session={session} />
                <ScenarioSessionAction session={session} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </SoftCard>
  );
}

type ScenarioSession = Parameters<typeof ScenarioHistoryCard>[0]["sessions"][number];

function ScenarioSessionMeta({ session }: { session: ScenarioSession }) {
  return (
    <p className="mt-1 text-xs text-ink-faint">
      {dateTimeFormatter.format(new Date(sessionDate(session)))} ·{" "}
      {session.status === "active"
        ? `已进行 ${session.learnerTurnCount} / ${session.maxTurns} 轮`
        : `${session.score ?? 0} 分 · ${
            session.verdict === "passed" ? "通过" : "需要重练"
          }`}
    </p>
  );
}

function ScenarioSessionAction({
  latest = false,
  session,
}: {
  latest?: boolean;
  session: ScenarioSession;
}) {
  return session.status === "active" ? (
    <SoftButtonLink
      href={`/practice/scenario/session/${session.id}`}
      variant="scenario"
      size="sm"
    >
      {latest ? "继续最新" : "继续训练"}
    </SoftButtonLink>
  ) : (
    <SoftButtonLink
      href={`/practice/scenario/report/${session.id}`}
      variant="secondary"
      size="sm"
    >
      {latest ? "查看完整报告" : "查看报告"}
    </SoftButtonLink>
  );
}

function sessionDate(session: ScenarioSession) {
  return session.status === "completed" && session.completedAt
    ? session.completedAt
    : session.updatedAt;
}

function sessionActivityAt(session: ScenarioSession) {
  return new Date(sessionDate(session)).getTime();
}

function timelineDateKey(session: ScenarioSession) {
  return timelineDateKeyFormatter.format(new Date(sessionDate(session)));
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
