import type { ScenarioCategory } from "@/lib/scenario/schema";
import type { KnowledgeUnit } from "./schema";

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
  listUnitsForScenario(
    category: ScenarioCategory,
    limit?: number,
  ): Promise<KnowledgeUnit[]>;
}

export class EmptyKnowledgeQueryStore
  implements KnowledgeQueryStore
{
  async loadActiveHealth(): Promise<KnowledgeHealth | null> {
    return null;
  }

  async listUnitsForScenario(): Promise<KnowledgeUnit[]> {
    return [];
  }
}
