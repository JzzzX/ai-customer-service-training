import { eq } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";

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
        .limit(1).all();

      return version ?? null;
    },

    async publishAtomically(publication) {
      return database.transaction((transaction) => {
        const [existing] = transaction
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
          .limit(1).all();
        if (existing) {
          return existing;
        }

        transaction
          .update(knowledgeVersions)
          .set({ isActive: false })
          .where(eq(knowledgeVersions.isActive, true));

        const [version] = transaction
          .insert(knowledgeVersions)
          .values({
            id: randomUUID(),
            ...publication.version,
            contentHash: hashContent(publication.version),
            status: "published",
            isActive: true,
            publishedAt: new Date(),
          })
          .returning({
            id: knowledgeVersions.id,
            versionHash: knowledgeVersions.versionHash,
          }).all();
        if (!version) {
          throw new Error("Knowledge version insert returned no row.");
        }

        if (publication.sources.length > 0) {
          transaction.insert(knowledgeSources).values(
            publication.sources.map((source) => ({
              id: randomUUID(),
              knowledgeVersionId: version.id,
              ...source,
            })),
          ).run();
        }

        for (const units of chunks(publication.units, 200)) {
          transaction.insert(knowledgeUnits).values(
            units.map((unit) => ({
              id: randomUUID(),
              knowledgeVersionId: version.id,
              ...unit,
            })),
          ).run();
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

function hashContent(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export type { PreparedKnowledgePublication };
