import type {
  AssignmentFilters,
  AssignmentStore,
  CreateAssignmentInput,
  TrainingAssignment,
} from "./assignment-store";
import type {
  ReviewDecisionInput,
  ReviewStore,
  TrainingReviewItem,
} from "./review-store";

export class LocalReadonlyAssignmentStore implements AssignmentStore {
  async create(
    input: CreateAssignmentInput,
  ): Promise<TrainingAssignment> {
    void input;
    throw new Error("本地演示模式不支持创建训练任务。");
  }

  async listForLearner(
    learnerId: string,
  ): Promise<TrainingAssignment[]> {
    void learnerId;
    return [];
  }

  async listForAdmin(
    filters?: AssignmentFilters,
  ): Promise<TrainingAssignment[]> {
    void filters;
    return [];
  }
}

export class LocalReadonlyReviewStore implements ReviewStore {
  async listPending(): Promise<TrainingReviewItem[]> {
    return [];
  }

  async load(reportId: string): Promise<TrainingReviewItem | null> {
    void reportId;
    return null;
  }

  async decide(
    input: ReviewDecisionInput,
  ): Promise<TrainingReviewItem> {
    void input;
    throw new Error("本地演示模式不支持人工复核。");
  }
}
