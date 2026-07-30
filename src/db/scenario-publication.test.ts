import { describe, expect, it } from "vitest";

import {
  publishScenarioTemplatesToStore,
  type PreparedScenarioPublication,
  type ResolvedScenarioKnowledge,
  type ScenarioPublicationStore,
} from "./scenario-publication";
import { scenarioTemplates } from "@/lib/scenario/templates";

const knowledgeVersionHash = "a".repeat(64);
const createdById = "00000000-0000-4000-8000-000000000001";

class MemoryScenarioPublicationStore
  implements ScenarioPublicationStore
{
  readonly versions = new Map<string, PreparedScenarioPublication>();

  constructor(
    private readonly knowledge: ResolvedScenarioKnowledge =
      resolvedKnowledge(),
  ) {}

  async resolveKnowledgeContext() {
    return this.knowledge;
  }

  async publishAtomically(
    publications: PreparedScenarioPublication[],
  ) {
    let created = 0;
    let existing = 0;
    for (const publication of publications) {
      if (this.versions.has(publication.version.versionKey)) {
        existing += 1;
      } else {
        this.versions.set(publication.version.versionKey, publication);
        created += 1;
      }
    }
    return { created, existing };
  }
}

describe("scenario database publication", () => {
  it("publishes exactly eight stable scenario versions idempotently", async () => {
    const store = new MemoryScenarioPublicationStore();

    const first = await publishScenarioTemplatesToStore({
      templates: scenarioTemplates,
      knowledgeVersionHash,
      createdById,
      store,
    });
    const second = await publishScenarioTemplatesToStore({
      templates: scenarioTemplates,
      knowledgeVersionHash,
      createdById,
      store,
    });

    expect(first).toEqual({ created: 8, existing: 0 });
    expect(second).toEqual({ created: 0, existing: 8 });
    expect(store.versions.size).toBe(8);
    expect(
      [...store.versions.values()].every(
        (publication) =>
          publication.version.scoringDimensions.reduce(
            (total, dimension) => total + dimension.weight,
            0,
          ) === 100,
      ),
    ).toBe(true);
  });

  it("rejects a source locator missing from the active knowledge version", async () => {
    const knowledge = resolvedKnowledge();
    knowledge.units = knowledge.units.slice(1);
    const store = new MemoryScenarioPublicationStore(knowledge);

    await expect(
      publishScenarioTemplatesToStore({
        templates: scenarioTemplates,
        knowledgeVersionHash,
        createdById,
        store,
      }),
    ).rejects.toThrow("场景来源未命中知识版本");
    expect(store.versions.size).toBe(0);
  });

  it("rejects a scenario source backed only by conflicting knowledge", async () => {
    const knowledge = resolvedKnowledge();
    knowledge.units[0] = {
      ...knowledge.units[0]!,
      hasConflict: true,
    };
    const store = new MemoryScenarioPublicationStore(knowledge);

    await expect(
      publishScenarioTemplatesToStore({
        templates: scenarioTemplates,
        knowledgeVersionHash,
        createdById,
        store,
      }),
    ).rejects.toThrow("冲突知识不能用于场景");
    expect(store.versions.size).toBe(0);
  });
});

function resolvedKnowledge(): ResolvedScenarioKnowledge {
  return {
    id: "00000000-0000-4000-8000-000000000020",
    versionHash: knowledgeVersionHash,
    isActive: true,
    units: scenarioTemplates.flatMap((scenario, scenarioIndex) =>
      scenario.sources.map((source, sourceIndex) => ({
        id: `00000000-0000-4000-8001-${String(
          scenarioIndex * 10 + sourceIndex,
        ).padStart(12, "0")}`,
        unitKey: `ku_${(scenarioIndex * 10 + sourceIndex)
          .toString(16)
          .padStart(24, "0")}`,
        sources: [source],
        hasConflict: false,
        canUseForScenario: true,
      })),
    ),
  };
}
