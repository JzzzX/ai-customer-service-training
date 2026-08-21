import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";
import { initializeDemoDatabase } from "./demo-fixture";
import { validateRuntimeEnvironment } from "@/lib/runtime/env";
import { isDemoMode } from "@/lib/runtime/mode";

type Environment = Record<string, string | undefined>;

export const DATABASE_SCHEMA_VERSION = 5;

const requiredTables = [
  "app_schema_marker",
  "evaluation_reports",
  "knowledge_sources",
  "knowledge_units",
  "knowledge_versions",
  "question_catalogs",
  "question_catalog_publications",
  "questions",
  "quiz_answers",
  "quiz_attempt_questions",
  "quiz_attempts",
  "quiz_set_questions",
  "quiz_sets",
  "remediation_exam_targets",
  "remediation_exams",
  "scenario_versions",
  "scenarios",
  "topic_quiz_answers",
  "topic_quiz_attempts",
  "training_messages",
  "training_sessions",
  "users",
] as const;

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

export function assertDatabaseSchema(database: DatabaseClient): void {
  try {
    const marker = database.$client
      .prepare("SELECT version FROM app_schema_marker LIMIT 1")
      .get() as { version?: number } | undefined;
    const tables = new Set(
      database.$client
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .map((row) => (row as { name: string }).name),
    );
    const integrity = database.$client.pragma("integrity_check", {
      simple: true,
    });
    const foreignKeyViolations = database.$client.pragma(
      "foreign_key_check",
    ) as unknown[];

    if (
      marker?.version !== DATABASE_SCHEMA_VERSION ||
      requiredTables.some((table) => !tables.has(table)) ||
      integrity !== "ok" ||
      foreignKeyViolations.length !== 0
    ) {
      throw new Error("incompatible");
    }
  } catch {
    throw new Error(
      "SQLite schema is incompatible. Run pnpm db:migrate before starting the application.",
    );
  }
}

let database: DatabaseClient | undefined;

const globalRuntime = globalThis as typeof globalThis & {
  __learnerLiteDemoDatabase?: DatabaseClient;
};

export function getDatabase() {
  validateRuntimeEnvironment();
  if (isDemoMode()) {
    if (!globalRuntime.__learnerLiteDemoDatabase) {
      const candidate = createDatabaseClient(":memory:");
      try {
        initializeDemoDatabase(candidate);
        assertDatabaseSchema(candidate);
        globalRuntime.__learnerLiteDemoDatabase = candidate;
      } catch (error) {
        candidate.$client.close();
        throw error;
      }
    }
    return globalRuntime.__learnerLiteDemoDatabase;
  }

  if (!database) {
    const candidate = createDatabaseClient(requireSqlitePath());
    try {
      assertDatabaseSchema(candidate);
      database = candidate;
    } catch (error) {
      candidate.$client.close();
      throw error;
    }
  }
  return database;
}
