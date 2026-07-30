import { reviewDecisionInputSchema } from "./review-schema";
import type { ReviewDecisionInput } from "./review-schema";
import type { ReviewStore } from "./review-store";

export class ReviewService {
  constructor(private readonly store: ReviewStore) {}

  listPending() {
    return this.store.listPending();
  }

  load(reportId: string) {
    return this.store.load(reportId);
  }

  async decide(input: ReviewDecisionInput) {
    return this.store.decide(reviewDecisionInputSchema.parse(input));
  }
}
