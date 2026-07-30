export type TrainingLearner = {
  id: string;
  name: string;
  email: string;
};

export type TrainingTarget = {
  id: string;
  type: "quiz" | "scenario";
  label: string;
};

export interface TrainingCatalogStore {
  listLearners(): Promise<TrainingLearner[]>;
  listTargets(): Promise<TrainingTarget[]>;
}

export class EmptyTrainingCatalogStore
  implements TrainingCatalogStore
{
  async listLearners(): Promise<TrainingLearner[]> {
    return [];
  }

  async listTargets(): Promise<TrainingTarget[]> {
    return [];
  }
}
