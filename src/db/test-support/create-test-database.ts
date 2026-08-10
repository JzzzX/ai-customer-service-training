import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { createDatabaseClient } from "../client";

export async function createTestDatabase() {
  const database = createDatabaseClient(":memory:");
  const migrationsDirectory = resolve(process.cwd(), "drizzle");
  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((file) => /^\d{4}_.*\.sql$/.test(file))
    .sort();
  for (const migrationFile of migrationFiles) {
    database.$client.exec(
      await readFile(resolve(migrationsDirectory, migrationFile), "utf8"),
    );
  }

  return {
    client: database.$client,
    database,
  };
}
