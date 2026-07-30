import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

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
  const client = neon(databaseUrl);
  return drizzle({ client, schema });
}

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;

let database: ReturnType<typeof createDatabaseClient> | undefined;

export function getDatabase() {
  validateRuntimeEnvironment();
  database ??= createDatabaseClient(requireDatabaseUrl());
  return database;
}
