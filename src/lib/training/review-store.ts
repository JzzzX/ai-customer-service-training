import type {
  ReviewDecisionInput,
  TrainingReviewItem,
} from "./review-schema";

export interface ReviewStore {
  listPending(): Promise<TrainingReviewItem[]>;
  load(reportId: string): Promise<TrainingReviewItem | null>;
  decide(input: ReviewDecisionInput): Promise<TrainingReviewItem>;
}

export type {
  ReviewDecisionInput,
  TrainingReviewItem,
} from "./review-schema";
