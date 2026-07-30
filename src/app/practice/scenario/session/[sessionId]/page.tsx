import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ScenarioChat } from "@/components/scenario/scenario-chat";
import { requireUser } from "@/lib/auth/guards";
import {
  getScenarioTemplateStore,
  getScenarioTrainingService,
} from "@/lib/runtime/services";

export default async function ScenarioSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const user = await requireUser();
  const { sessionId } = await params;
  const session = await loadSession(user.id, sessionId);
  if (session.status === "completed") {
    redirect(`/practice/scenario/report/${session.id}`);
  }
  const scenario =
    await getScenarioTemplateStore().getPublishedById(
      session.scenarioId,
    );
  if (!scenario || scenario.versionId !== session.scenarioVersionId) {
    notFound();
  }

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-start justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-[#5c7cdb]">情景实战</p>
              <span className="rounded-full bg-[#eef3ff] px-3 py-1 text-xs font-bold text-[#5c7cdb]">
                演示模式
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-black text-[#21312a]">
              模拟接待
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#68786f]">
              {scenario.summary} 页面刷新后会恢复当前对话。
            </p>
          </div>
          <Link
            className="shrink-0 font-bold text-[#65756d]"
            href="/practice/scenario"
          >
            退出
          </Link>
        </header>

        <div className="mt-7">
          <ScenarioChat
            initialSession={session}
            scenarioTitle={scenario.title}
          />
        </div>
      </div>
    </main>
  );
}

async function loadSession(learnerId: string, sessionId: string) {
  try {
    return await getScenarioTrainingService().load({
      learnerId,
      sessionId,
    });
  } catch {
    notFound();
  }
}
