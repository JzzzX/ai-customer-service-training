"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { getReviewService } from "@/lib/runtime/services";

const reviewFormSchema = z.object({
  reportId: z.string().uuid(),
  status: z.enum(["confirmed", "adjusted", "dismissed"]),
  correctedVerdict: z.preprocess(
    emptyToUndefined,
    z.enum(["passed", "needs_retry"]).optional(),
  ),
  correctedScore: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(0).max(100).optional(),
  ),
  comment: z.string().trim().min(1).max(2000),
});

export async function decideReviewAction(
  formData: FormData,
): Promise<void> {
  const admin = await requireAdmin();
  const input = reviewFormSchema.parse(Object.fromEntries(formData));
  await getReviewService().decide({
    ...input,
    reviewerId: admin.id,
  });
  revalidatePath("/admin/reviews");
  redirect("/admin/reviews?reviewed=1");
}

function emptyToUndefined(value: unknown) {
  return value === "" || value === null ? undefined : value;
}
