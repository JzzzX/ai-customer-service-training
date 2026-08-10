import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { SoftBadge } from "@/components/ui/soft-badge";
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
        <PageHeader
          action={
            <SoftBadge variant={session.mode === "real" ? "success" : "scenario"}>
              {session.mode === "real" ? "AI 实战" : "演示模式"}
            </SoftBadge>
          }
          backHref="/practice/scenario"
          backLabel="退出"
          description={`${scenario.summary} 页面刷新后会恢复当前对话。`}
          label="情景实战"
          title="模拟接待"
        />

        <div className="mt-7 animate-fade-in-up stagger-1">
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
