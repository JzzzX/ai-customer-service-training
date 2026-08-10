import type { ScenarioTemplate } from "./schema";

export interface ScenarioTemplateStore {
  listPublished(): Promise<ScenarioTemplate[]>;
  getPublishedById(scenarioId: string): Promise<ScenarioTemplate | null>;
}
