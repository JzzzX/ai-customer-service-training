import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDatabase } from "./client";
import type { DatabaseClient } from "./client";
import {
  knowledgeUnits,
  knowledgeVersions,
  scenarios,
  scenarioVersions,
} from "./schema";
import type { SourceLocator } from "@/lib/knowledge/schema";
import {
  scenarioTemplatesSchema,
  type ScenarioTemplate,
} from "@/lib/scenario/schema";

export type ResolvedScenarioKnowledge = {
  id: string;
  versionHash: string;
  isActive: boolean;
  units: Array<{
    id: string;
    unitKey: string;
    sources: SourceLocator[];
    hasConflict: boolean;
    canUseForScenario: boolean;
  }>;
};

export type PreparedScenarioPublication = {
  scenario: {
    scenarioKey: string;
    title: string;
    category: string;
    createdById: string;
  };
  version: {
    versionKey: string;
    version: number;
    knowledgeVersionId: string;
    background: string;
    summary: string;
    firstCustomerMessage: string;
    controlledVariables: Record<string, unknown>;
    hiddenFacts: string[];
    customerTurns: string[];
    checkpoints: string[];
    prohibitions: string[];
    scoringWeights: Record<string, number>;
    scoringDimensions: ScenarioTemplate["scoringDimensions"];
    criticalRisks: ScenarioTemplate["criticalRisks"];
    referenceFlow: string[];
    referenceReply: string;
    sources: SourceLocator[];
    maxTurns: number;
    mockMode: boolean;
    customerPersona: ScenarioTemplate["customerPersona"] | null;
    difficulty: ScenarioTemplate["difficulty"];
    createdById: string;
  };
};

export interface ScenarioPublicationStore {
  resolveKnowledgeContext(
    versionHash: string,
  ): Promise<ResolvedScenarioKnowledge | null>;
  publishAtomically(
    publications: PreparedScenarioPublication[],
  ): Promise<{ created: number; existing: number }>;
}

export async function publishScenarioTemplatesToStore(input: {
  templates: ScenarioTemplate[];
  knowledgeVersionHash: string;
  createdById: string;
  store: ScenarioPublicationStore;
}): Promise<{ created: number; existing: number }> {
  const templates = scenarioTemplatesSchema.parse(input.templates);
  const createdById = z.string().uuid().parse(input.createdById);
  const knowledge = await input.store.resolveKnowledgeContext(
    input.knowledgeVersionHash,
  );
  if (!knowledge) {
    throw new Error("找不到场景绑定的知识版本。");
  }
  if (!knowledge.isActive) {
    throw new Error("场景绑定的知识版本不是当前活动版本。");
  }

  const unitsBySource = new Map<
    string,
    ResolvedScenarioKnowledge["units"]
  >();
  for (const unit of knowledge.units) {
    for (const source of unit.sources) {
      const key = sourceKey(source);
      unitsBySource.set(key, [
        ...(unitsBySource.get(key) ?? []),
        unit,
      ]);
    }
  }

  const publications = templates.map((template) => {
    for (const source of template.sources) {
      const matched = unitsBySource.get(sourceKey(source)) ?? [];
      if (matched.length === 0) {
        throw new Error(
          `场景来源未命中知识版本：${source.sourcePath}#${source.anchor}`,
        );
      }
      if (matched.some((unit) => unit.hasConflict)) {
        throw new Error(
          `冲突知识不能用于场景：${source.sourcePath}#${source.anchor}`,
        );
      }
      if (matched.some((unit) => !unit.canUseForScenario)) {
        throw new Error(
          `知识单元未获准用于场景：${source.sourcePath}#${source.anchor}`,
        );
      }
    }

    return prepareScenarioPublication(
      template,
      knowledge.id,
      createdById,
    );
  });
  return input.store.publishAtomically(publications);
}

export function createScenarioPublicationStore(
  database: DatabaseClient = getDatabase(),
): ScenarioPublicationStore {
  return {
    async resolveKnowledgeContext(versionHash) {
      const [version] = await database
        .select({
          id: knowledgeVersions.id,
          versionHash: knowledgeVersions.versionHash,
          isActive: knowledgeVersions.isActive,
        })
        .from(knowledgeVersions)
        .where(eq(knowledgeVersions.versionHash, versionHash))
        .limit(1);
      if (!version) {
        return null;
      }
      const units = await database
        .select({
          id: knowledgeUnits.id,
          unitKey: knowledgeUnits.unitKey,
          sources: knowledgeUnits.sources,
          hasConflict: knowledgeUnits.hasConflict,
          canUseForScenario: knowledgeUnits.canUseForScenario,
        })
        .from(knowledgeUnits)
        .where(eq(knowledgeUnits.knowledgeVersionId, version.id));
      return { ...version, units };
    },

    async publishAtomically(publications) {
      return database.transaction(async (transaction) => {
        let created = 0;
        let existing = 0;

        for (const publication of publications) {
          const [insertedScenario] = await transaction
            .insert(scenarios)
            .values({ ...publication.scenario, status: "published" })
            .onConflictDoNothing({ target: scenarios.scenarioKey })
            .returning({
              id: scenarios.id,
              title: scenarios.title,
              category: scenarios.category,
            });
          const scenario =
            insertedScenario ??
            (
              await transaction
                .select({
                  id: scenarios.id,
                  title: scenarios.title,
                  category: scenarios.category,
                })
                .from(scenarios)
                .where(
                  eq(
                    scenarios.scenarioKey,
                    publication.scenario.scenarioKey,
                  ),
                )
                .limit(1)
            )[0];
          if (!scenario) {
            throw new Error("场景并发发布后无法读取。");
          }
          if (
            scenario.title !== publication.scenario.title ||
            scenario.category !== publication.scenario.category
          ) {
            throw new Error(
              `同一场景键存在不同内容：${publication.scenario.scenarioKey}`,
            );
          }

          const [storedVersion] = await transaction
            .select()
            .from(scenarioVersions)
            .where(
              eq(
                scenarioVersions.versionKey,
                publication.version.versionKey,
              ),
            )
            .limit(1);
          if (storedVersion) {
            if (
              storedVersion.scenarioId !== scenario.id ||
              !matchesScenarioVersion(storedVersion, publication.version)
            ) {
              throw new Error(
                `同一场景版本键存在不同内容：${publication.version.versionKey}`,
              );
            }
            existing += 1;
            continue;
          }

          await transaction.insert(scenarioVersions).values({
            scenarioId: scenario.id,
            ...publication.version,
            status: "published",
            publishedAt: new Date(),
          });
          created += 1;
        }
        return { created, existing };
      });
    },
  };
}

function prepareScenarioPublication(
  template: ScenarioTemplate,
  knowledgeVersionId: string,
  createdById: string,
): PreparedScenarioPublication {
  return {
    scenario: {
      scenarioKey: template.id,
      title: template.title,
      category: template.category,
      createdById,
    },
    version: {
      versionKey: template.versionId,
      version: 1,
      knowledgeVersionId,
      background: template.summary,
      summary: template.summary,
      firstCustomerMessage: template.openingMessage,
      controlledVariables: {},
      hiddenFacts: template.hiddenFacts,
      customerTurns: template.customerTurns,
      checkpoints: template.referenceFlow,
      prohibitions: template.criticalRisks.map((risk) => risk.label),
      scoringWeights: Object.fromEntries(
        template.scoringDimensions.map((dimension) => [
          dimension.name,
          dimension.weight,
        ]),
      ),
      scoringDimensions: template.scoringDimensions,
      criticalRisks: template.criticalRisks,
      referenceFlow: template.referenceFlow,
      referenceReply: template.referenceReply,
      sources: template.sources,
      maxTurns: template.maxTurns,
      mockMode: template.mockMode,
      customerPersona: template.customerPersona ?? null,
      difficulty: template.difficulty,
      createdById,
    },
  };
}

function matchesScenarioVersion(
  stored: typeof scenarioVersions.$inferSelect,
  prepared: PreparedScenarioPublication["version"],
): boolean {
  return (
    stored.version === prepared.version &&
    stored.knowledgeVersionId === prepared.knowledgeVersionId &&
    stored.background === prepared.background &&
    stored.summary === prepared.summary &&
    stored.firstCustomerMessage === prepared.firstCustomerMessage &&
    jsonValuesEqual(
      stored.controlledVariables,
      prepared.controlledVariables,
    ) &&
    jsonValuesEqual(stored.hiddenFacts, prepared.hiddenFacts) &&
    jsonValuesEqual(stored.customerTurns, prepared.customerTurns) &&
    jsonValuesEqual(stored.checkpoints, prepared.checkpoints) &&
    jsonValuesEqual(stored.prohibitions, prepared.prohibitions) &&
    jsonValuesEqual(stored.scoringWeights, prepared.scoringWeights) &&
    jsonValuesEqual(
      stored.scoringDimensions,
      prepared.scoringDimensions,
    ) &&
    jsonValuesEqual(stored.criticalRisks, prepared.criticalRisks) &&
    jsonValuesEqual(stored.referenceFlow, prepared.referenceFlow) &&
    stored.referenceReply === prepared.referenceReply &&
    jsonValuesEqual(stored.sources, prepared.sources) &&
    stored.maxTurns === prepared.maxTurns &&
    stored.mockMode === prepared.mockMode
  );
}

function sourceKey(source: SourceLocator): string {
  return `${source.sourcePath}\u0000${source.anchor}`;
}

export function jsonValuesEqual(
  left: unknown,
  right: unknown,
): boolean {
  return JSON.stringify(canonicalJson(left)) ===
    JSON.stringify(canonicalJson(right));
}

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalJson);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([leftKey], [rightKey]) =>
          leftKey.localeCompare(rightKey),
        )
        .map(([key, child]) => [key, canonicalJson(child)]),
    );
  }
  return value;
}
