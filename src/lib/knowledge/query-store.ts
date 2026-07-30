export type KnowledgeHealth = {
  versionId: string;
  versionHash: string;
  sourceRoot: string;
  status: "draft" | "published" | "disabled" | "archived";
  createdAt: string;
  sourceCount: number;
  unitCount: number;
  conflictCount: number;
  questionCount: number;
  publishedQuizCount: number;
  publishedScenarioCount: number;
};

export interface KnowledgeQueryStore {
  loadActiveHealth(): Promise<KnowledgeHealth | null>;
}

export class EmptyKnowledgeQueryStore
  implements KnowledgeQueryStore
{
  async loadActiveHealth(): Promise<KnowledgeHealth | null> {
    return null;
  }
}
