"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { getAssignmentService } from "@/lib/runtime/services";

const assignmentFormSchema = z.object({
  learnerId: z.string().uuid(),
  target: z
    .string()
    .regex(
      /^(quiz|scenario):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    ),
  dueAt: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().optional(),
  ),
});

export async function createAssignmentAction(
  formData: FormData,
): Promise<void> {
  const admin = await requireAdmin();
  const input = assignmentFormSchema.parse(Object.fromEntries(formData));
  const [assignmentType, targetId] = input.target.split(":") as [
    "quiz" | "scenario",
    string,
  ];
  const createdAt = new Date().toISOString();
  const dueAt = input.dueAt
    ? new Date(input.dueAt).toISOString()
    : undefined;

  await getAssignmentService().create({
    learnerId: input.learnerId,
    assignedById: admin.id,
    assignmentType,
    targetId,
    dueAt,
    createdAt,
  });
  revalidatePath("/admin/assignments");
  revalidatePath("/practice/assignments");
  redirect("/admin/assignments?created=1");
}
