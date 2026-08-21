import { revalidatePath } from "next/cache";

import {
  createAdminQuestionRepository,
  type AdminQuestionEditableChanges,
} from "@/db/admin-question-repository";
import { requireAdmin } from "@/lib/auth/guards";

type Repository = ReturnType<typeof createAdminQuestionRepository>;

export function createAdminQuestionActions(dependencies: {
  requireAdmin: typeof requireAdmin;
  repository: Repository;
  revalidate: (path: string) => void;
}) {
  return {
    async createDraft(input: {
      catalogId: string;
      baseRevisionId: string;
      changes: AdminQuestionEditableChanges;
    }) {
      const admin = await dependencies.requireAdmin();
      const draft = await dependencies.repository.createDraft({ ...input, actorId: admin.id });
      dependencies.revalidate("/admin/questions");
      return draft;
    },
    async publishDraft(input: {
      catalogId: string;
      draftRevisionId: string;
      expectedCurrentRevisionId: string;
    }) {
      const admin = await dependencies.requireAdmin();
      const published = await dependencies.repository.publishDraft({ ...input, actorId: admin.id });
      dependencies.revalidate("/admin/questions");
      return published;
    },
  };
}

function defaultActions() {
  return createAdminQuestionActions({
    requireAdmin,
    repository: createAdminQuestionRepository(),
    revalidate: revalidatePath,
  });
}

export async function createQuestionDraftAction(input: {
  catalogId: string;
  baseRevisionId: string;
  changes: AdminQuestionEditableChanges;
}) {
  "use server";
  return defaultActions().createDraft(input);
}

export async function publishQuestionDraftAction(input: {
  catalogId: string;
  draftRevisionId: string;
  expectedCurrentRevisionId: string;
}) {
  "use server";
  return defaultActions().publishDraft(input);
}

export async function createQuestionDraftFromFormAction(formData: FormData) {
  "use server";
  const options = String(formData.get("options") ?? "").split("\n").map((value) => value.trim()).filter(Boolean);
  await createQuestionDraftAction({
    catalogId: String(formData.get("catalogId") ?? ""),
    baseRevisionId: String(formData.get("baseRevisionId") ?? ""),
    changes: {
      prompt: String(formData.get("prompt") ?? ""),
      options,
      correctAnswers: [String(formData.get("correctAnswer") ?? "").trim()],
      explanation: String(formData.get("explanation") ?? ""),
      category: String(formData.get("category") ?? ""),
      difficulty: String(formData.get("difficulty") ?? "") as AdminQuestionEditableChanges["difficulty"],
    },
  });
}

export async function publishQuestionDraftFromFormAction(formData: FormData) {
  "use server";
  await publishQuestionDraftAction({
    catalogId: String(formData.get("catalogId") ?? ""),
    draftRevisionId: String(formData.get("draftRevisionId") ?? ""),
    expectedCurrentRevisionId: String(formData.get("expectedCurrentRevisionId") ?? ""),
  });
}
