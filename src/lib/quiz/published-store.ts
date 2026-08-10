import type { QuizPublishedPack } from "./schema";

/**
 * 学员端只读取当前正式题组；发布与审核属于离线内容运维流程。
 */
export interface PublishedQuizStore {
  loadPublished(): Promise<QuizPublishedPack | null>;
}
