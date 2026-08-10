import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createDatabaseClient } from "../client";

export async function createTestDatabase() {
  const database = createDatabaseClient(":memory:");
  const migration = await readFile(
    resolve(process.cwd(), "drizzle/0000_fixed_giant_man.sql"),
    "utf8",
  );
  database.$client.exec(migration);

  return {
    client: database.$client,
    database,
  };
}
