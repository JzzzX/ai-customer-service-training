"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { requireUser } from "@/lib/auth/guards";
import { getScenarioTrainingService } from "@/lib/runtime/services";
import { reportRuntimeError } from "@/lib/runtime/errors";
import {
  classifyAiGatewayError,
  toPublicAiGatewayError,
} from "@/lib/scenario/ai-errors";

const scenarioIdSchema = z.string().regex(/^st_[a-f0-9]{24}$/);
const sessionIdSchema = z.string().uuid();
const messageSchema = z.string().trim().min(1).max(1000);

type SendMessageResult = Awaited<
  ReturnType<
    ReturnType<typeof getScenarioTrainingService>["sendMessage"]
  >
>;

export type ScenarioMessageActionState = {
  error?: string;
  result?: SendMessageResult;
};

export type ScenarioStartActionState = {
  error?: string;
  incidentId?: string;
};

export async function startScenarioAction(
  _previousState: ScenarioStartActionState,
  formData: FormData,
): Promise<ScenarioStartActionState> {
  const user = await requireUser();
  const scenarioId = scenarioIdSchema.parse(formData.get("scenarioId"));
  let session: Awaited<
    ReturnType<ReturnType<typeof getScenarioTrainingService>["start"]>
  >;
  try {
    session = await getScenarioTrainingService().start({
      learnerId: user.id,
      scenarioId,
    });
  } catch (error) {
    const incidentId = randomUUID();
    reportRuntimeError(
      {
        route: "/practice/scenario",
        operation: "start_session",
        userId: user.id,
        resourceId: scenarioId,
        incidentId,
      },
      error,
    );
    return {
      error: "训练会话创建失败，请重试。",
      incidentId,
    };
  }
  redirect(`/practice/scenario/session/${session.id}`);
}

export async function sendScenarioMessageAction(
  _previousState: ScenarioMessageActionState,
  formData: FormData,
): Promise<ScenarioMessageActionState> {
  const user = await requireUser();
  const sessionId = sessionIdSchema.parse(formData.get("sessionId"));
  const content = messageSchema.safeParse(formData.get("content"));
  if (!content.success) {
    return { error: "请输入回复内容。" };
  }

  try {
    const result = await getScenarioTrainingService().sendMessage({
      learnerId: user.id,
      sessionId,
      content: content.data,
    });
    return { result };
  } catch (error) {
    reportRuntimeError(
      {
        errorCategory: classifyAiGatewayError(error).kind,
        route: "/practice/scenario/session",
        userId: user.id,
        resourceId: sessionId,
      },
      error,
    );
    return {
      error: toPublicAiGatewayError(error),
    };
  }
}

export async function completeScenarioAction(
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const sessionId = sessionIdSchema.parse(formData.get("sessionId"));
  const session = await getScenarioTrainingService().complete({
    learnerId: user.id,
    sessionId,
  });
  revalidatePracticePaths();
  redirect(`/practice/scenario/report/${session.id}`);
}

export async function restartScenarioAction(
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const sessionId = sessionIdSchema.parse(formData.get("sessionId"));
  const session = await getScenarioTrainingService().restart({
    learnerId: user.id,
    sessionId,
  });
  revalidatePracticePaths();
  redirect(`/practice/scenario/session/${session.id}`);
}

function revalidatePracticePaths(): void {
  revalidatePath("/practice");
  revalidatePath("/practice/scenario");
  revalidatePath("/practice/profile");
}
