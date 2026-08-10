import { getPublishedQuizStore } from "@/lib/runtime/services";

import type { QuizPublishedPack } from "./schema";

export async function loadPublishedQuiz(): Promise<QuizPublishedPack | null> {
  return getPublishedQuizStore().loadPublished();
}
