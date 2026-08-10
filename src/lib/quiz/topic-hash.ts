import { createHash } from "node:crypto";

export function createTopicQuizHash(topicId: string): string {
  return createHash("sha256").update(`topic:${topicId}`).digest("hex");
}
