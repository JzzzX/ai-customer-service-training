import { getPublishedQuizStore } from "@/lib/runtime/services";

import type { QuizPublishedPack } from "./schema";
import type { PublishedTopicSummary } from "./published-store";

export async function loadPublishedQuiz(): Promise<QuizPublishedPack | null> {
  return getPublishedQuizStore().loadPublished();
}

export async function loadPublishedTopicQuiz(
  topicId: string,
): Promise<QuizPublishedPack | null> {
  return getPublishedQuizStore().loadPublishedTopic(topicId);
}

export async function listPublishedQuizTopics(): Promise<
  PublishedTopicSummary[]
> {
  return getPublishedQuizStore().listPublishedTopics();
}
