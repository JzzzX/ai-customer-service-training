"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import {
  approveQuizQuestionForAdmin,
  publishQuizForLearners,
} from "@/lib/quiz/review-service";

export type ReviewActionState = {
  error?: string;
};

const reviewFormSchema = z.object({
  questionId: z.string().regex(/^qq_[a-f0-9]{24}$/),
  index: z.coerce.number().int().nonnegative(),
  total: z.coerce.number().int().positive(),
  prompt: z.string().trim().min(1),
  options: z.string().trim().min(1),
  correctAnswer: z.string().trim().min(1),
  explanation: z.string().trim().min(1),
  category: z.string().trim().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

export async function approveQuestionAction(
  _previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const user = await requireAdmin();
  const parsed = reviewFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "请完整填写题干、选项、正确答案和解释。" };
  }

  try {
    await approveQuizQuestionForAdmin({
      questionId: parsed.data.questionId,
      reviewerId: user.id,
      changes: {
        prompt: parsed.data.prompt,
        options: parsed.data.options
          .split("\n")
          .map((option) => option.trim())
          .filter(Boolean),
        correctAnswer: parsed.data.correctAnswer,
        explanation: parsed.data.explanation,
        category: parsed.data.category,
        difficulty: parsed.data.difficulty,
      },
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "题目审核失败。",
    };
  }

  revalidatePath("/admin/questions");
  const nextIndex = Math.min(parsed.data.index + 1, parsed.data.total - 1);
  redirect(`/admin/questions?index=${nextIndex}`);
}

export async function publishQuizAction(): Promise<void> {
  await requireAdmin();
  await publishQuizForLearners();
  revalidatePath("/admin/questions");
  revalidatePath("/practice/quiz");
  redirect("/admin/questions?published=1");
}
