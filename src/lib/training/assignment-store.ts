import type {
  AssignmentFilters,
  CreateAssignmentInput,
  TrainingAssignment,
} from "./assignment-schema";

export interface AssignmentStore {
  create(input: CreateAssignmentInput): Promise<TrainingAssignment>;
  listForLearner(learnerId: string): Promise<TrainingAssignment[]>;
  listForAdmin(
    filters?: AssignmentFilters,
  ): Promise<TrainingAssignment[]>;
}

export type {
  AssignmentFilters,
  CreateAssignmentInput,
  TrainingAssignment,
} from "./assignment-schema";
