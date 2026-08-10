import { eq } from "drizzle-orm";

import { getDatabase } from "./client";
import {
  knowledgeSources,
  knowledgeUnits,
  knowledgeVersions,
} from "./schema";
import {
  publishKnowledgePackToStore,
} from "./knowledge-publication";
import type {
  KnowledgePackStore,
  PreparedKnowledgePublication,
} from "./knowledge-publication";
import type { KnowledgePack } from "@/lib/knowledge/schema";

type Database = ReturnType<typeof getDatabase>;

export function createKnowledgePackStore(
  database: Database = getDatabase(),
): KnowledgePackStore {
  return {
    async findVersionByHash(versionHash) {
      const [version] = await database
        .select({
          id: knowledgeVersions.id,
          versionHash: knowledgeVersions.versionHash,
        })
        .from(knowledgeVersions)
        .where(eq(knowledgeVersions.versionHash, versionHash))
        .limit(1);

      return version ?? null;
    },

    async publishAtomically(publication) {
      return database.transaction(async (transaction) => {
        const [existing] = await transaction
          .select({
            id: knowledgeVersions.id,
            versionHash: knowledgeVersions.versionHash,
          })
          .from(knowledgeVersions)
          .where(
            eq(
              knowledgeVersions.versionHash,
              publication.version.versionHash,
            ),
          )
          .limit(1);
        if (existing) {
          return existing;
        }

        await transaction
          .update(knowledgeVersions)
          .set({ isActive: false })
          .where(eq(knowledgeVersions.isActive, true));

        const [version] = await transaction
          .insert(knowledgeVersions)
          .values({
            ...publication.version,
            status: "published",
            isActive: true,
            publishedAt: new Date(),
          })
          .returning({
            id: knowledgeVersions.id,
            versionHash: knowledgeVersions.versionHash,
          });
        if (!version) {
          throw new Error("Knowledge version insert returned no row.");
        }

        if (publication.sources.length > 0) {
          await transaction.insert(knowledgeSources).values(
            publication.sources.map((source) => ({
              knowledgeVersionId: version.id,
              ...source,
            })),
          );
        }

        for (const units of chunks(publication.units, 200)) {
          await transaction.insert(knowledgeUnits).values(
            units.map((unit) => ({
              knowledgeVersionId: version.id,
              ...unit,
            })),
          );
        }

        return version;
      });
    },
  };
}

export async function publishKnowledgePackToDatabase(pack: KnowledgePack) {
  return publishKnowledgePackToStore(pack, createKnowledgePackStore());
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

export type { PreparedKnowledgePublication };
