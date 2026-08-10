import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";
import { validateRuntimeEnvironment } from "@/lib/runtime/env";

type Environment = Record<string, string | undefined>;

export function requireSqlitePath(
  environment: Environment = process.env,
): string {
  const sqlitePath = environment.SQLITE_PATH?.trim();
  if (!sqlitePath) {
    throw new Error(
      "SQLITE_PATH must point to a writable SQLite database file.",
    );
  }
  return sqlitePath;
}

export function createDatabaseClient(sqlitePath: string) {
  const client = new Database(sqlitePath);
  client.pragma("foreign_keys = ON");
  client.pragma("journal_mode = WAL");
  client.pragma("busy_timeout = 5000");
  return drizzle({ client, schema });
}

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;

let database: DatabaseClient | undefined;

export function getDatabase() {
  validateRuntimeEnvironment();
  database ??= createDatabaseClient(requireSqlitePath());
  return database;
}
