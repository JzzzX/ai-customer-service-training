import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "../schema";

export async function createTestDatabase() {
  const client = new PGlite();
  for (const migration of [
    "drizzle/0000_tiresome_rocket_racer.sql",
    "drizzle/0001_brave_steve_rogers.sql",
    "drizzle/0002_nervous_captain_flint.sql",
    "drizzle/0003_spotty_donald_blake.sql",
    "drizzle/0004_warm_iceman.sql",
  ]) {
    await client.exec(
      await readFile(resolve(process.cwd(), migration), "utf8"),
    );
  }

  return {
    client,
    database: drizzle(client, { schema }),
  };
}
