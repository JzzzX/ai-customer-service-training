import { describe, expect, it } from "vitest";

import {
  createScenarioPublicationStore,
  jsonValuesEqual,
  publishScenarioTemplatesToStore,
  type PreparedScenarioPublication,
  type ResolvedScenarioKnowledge,
  type ScenarioPublicationStore,
} from "./scenario-publication";
import { knowledgeUnits, knowledgeVersions } from "./schema";
import { createTestDatabase } from "./test-support/create-test-database";
import { scenarioTemplates } from "@/lib/scenario/templates";

const knowledgeVersionHash = "a".repeat(64);

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
  it("compares JSONB values independently of object key order", () => {
    expect(
      jsonValuesEqual(
        { second: 2, first: { beta: true, alpha: true } },
        { first: { alpha: true, beta: true }, second: 2 },
      ),
    ).toBe(true);
  });

  it("publishes exactly nine stable scenario versions idempotently", async () => {
    const store = new MemoryScenarioPublicationStore();

    const first = await publishScenarioTemplatesToStore({
      templates: scenarioTemplates,
      knowledgeVersionHash,
      store,
    });
    const second = await publishScenarioTemplatesToStore({
      templates: scenarioTemplates,
      knowledgeVersionHash,
      store,
    });

    expect(first).toEqual({ created: 9, existing: 0 });
    expect(second).toEqual({ created: 0, existing: 9 });
    expect(store.versions.size).toBe(9);
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

  it("rejects changed persona and difficulty for an existing SQLite version", async () => {
    const { client, database } = await createTestDatabase();
    const versionId = "00000000-0000-4000-8000-000000000020";
    const template = scenarioTemplates[0]!;
    await database.insert(knowledgeVersions).values({
      id: versionId, versionHash: knowledgeVersionHash, contentHash: "a".repeat(64), schemaVersion: 1,
      sourceRoot: "test", status: "published", isActive: true, coverage: {},
    });
    await database.insert(knowledgeUnits).values({
      id: "00000000-0000-4000-8000-000000000021", knowledgeVersionId: versionId, unitKey: "ku_test",
      title: "test", content: "test", categoryPath: ["test"], contentHash: "b".repeat(64),
      sources: template.sources, hasConflict: false,
    });
    const store = createScenarioPublicationStore(database);
    await publishScenarioTemplatesToStore({ templates: [template], knowledgeVersionHash, store });
    const changed = { ...template, customerPersona: { ...template.customerPersona!, temperament: "anxious" as const }, difficulty: "hard" as const };
    await expect(publishScenarioTemplatesToStore({ templates: [changed], knowledgeVersionHash, store })).rejects.toThrow("同一场景版本键存在不同内容");
    client.close();
  });

  it("rejects a source locator missing from the active knowledge version", async () => {
    const knowledge = resolvedKnowledge();
    knowledge.units = knowledge.units.slice(1);
    const store = new MemoryScenarioPublicationStore(knowledge);

    await expect(
      publishScenarioTemplatesToStore({
        templates: scenarioTemplates,
        knowledgeVersionHash,
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
        store,
      }),
    ).rejects.toThrow("冲突知识不能用于场景");
    expect(store.versions.size).toBe(0);
  });

  it.each(["draft", "archived"] as const)(
    "rejects an active knowledge version whose lifecycle status is %s",
    async (status) => {
      const store = new MemoryScenarioPublicationStore({
        ...resolvedKnowledge(),
        status,
      });

      await expect(publishScenarioTemplatesToStore({
        templates: scenarioTemplates,
        knowledgeVersionHash,
        store,
      })).rejects.toThrow("不是当前已发布版本");
      expect(store.versions.size).toBe(0);
    },
  );
});

function resolvedKnowledge(): ResolvedScenarioKnowledge {
  return {
    id: "00000000-0000-4000-8000-000000000020",
    versionHash: knowledgeVersionHash,
    isActive: true,
    status: "published" as const,
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
