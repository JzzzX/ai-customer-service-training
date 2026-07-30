import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

import * as schema from "./schema";
import { validateRuntimeEnvironment } from "@/lib/runtime/env";

type Environment = Record<string, string | undefined>;

export function requireDatabaseUrl(
  environment: Environment = process.env,
): string {
  const databaseUrl = environment.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL must be a Neon PostgreSQL connection string.",
    );
  }

  return databaseUrl;
}

export function createDatabaseClient(databaseUrl: string) {
  return drizzle({
    connection: databaseUrl,
    ws,
    schema,
  });
}

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;

let database: ReturnType<typeof createDatabaseClient> | undefined;

export function getDatabase() {
  validateRuntimeEnvironment();
  database ??= createDatabaseClient(requireDatabaseUrl());
  return database;
}
