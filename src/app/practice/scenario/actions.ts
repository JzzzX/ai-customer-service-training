"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/guards";
import { getScenarioTrainingService } from "@/lib/runtime/services";
import {
  reportRuntimeError,
  toPublicRuntimeError,
} from "@/lib/runtime/errors";

const scenarioIdSchema = z.string().regex(/^st_[a-f0-9]{24}$/);
const sessionIdSchema = z.string().uuid();
const optionalAssignmentIdSchema = z.preprocess(
  (value) => (value === null || value === "" ? undefined : value),
  z.string().uuid().optional(),
);
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

export async function startScenarioAction(
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const scenarioId = scenarioIdSchema.parse(formData.get("scenarioId"));
  const assignmentId = optionalAssignmentIdSchema.parse(
    formData.get("assignmentId"),
  );
  const session = await getScenarioTrainingService().start({
    learnerId: user.id,
    scenarioId,
    assignmentId,
  });
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
        route: "/practice/scenario/session",
        userId: user.id,
        resourceId: sessionId,
      },
      error,
    );
    return {
      error: toPublicRuntimeError(error, "AI 服务暂时不可用，请稍后重试。"),
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
