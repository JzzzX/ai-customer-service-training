import { createAssignmentInputSchema } from "./assignment-schema";
import type {
  CreateAssignmentInput,
  TrainingAssignment,
} from "./assignment-schema";
import type { AssignmentStore } from "./assignment-store";

export class AssignmentService {
  constructor(private readonly store: AssignmentStore) {}

  async create(
    input: CreateAssignmentInput,
  ): Promise<TrainingAssignment> {
    return this.store.create(createAssignmentInputSchema.parse(input));
  }

  listForLearner(learnerId: string) {
    return this.store.listForLearner(learnerId);
  }

  listForAdmin(
    filters?: Parameters<AssignmentStore["listForAdmin"]>[0],
  ) {
    return this.store.listForAdmin(filters);
  }
}
