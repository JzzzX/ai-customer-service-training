import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertDatabaseSchema,
  createDatabaseClient,
  requireSqlitePath,
} from "./client";
import { createTestDatabase } from "./test-support/create-test-database";

describe("SQLite database client", () => {
  it("fails clearly when SQLITE_PATH is unavailable", () => {
    expect(() => requireSqlitePath({})).toThrow(
      "SQLITE_PATH must point to a writable SQLite database file",
    );
    expect(() => requireSqlitePath({ SQLITE_PATH: "  " })).toThrow(
      "SQLITE_PATH must point to a writable SQLite database file",
    );
  });

  it("opens SQLite with foreign keys, WAL, and a five second busy timeout", () => {
    const directory = mkdtempSync(join(tmpdir(), "ai-training-sqlite-"));
    const database = createDatabaseClient(join(directory, "training.sqlite"));
    try {
      expect(database).toBeDefined();
      expect(database.transaction).toBeTypeOf("function");
      expect(database.$client.pragma("foreign_keys", { simple: true })).toBe(1);
      expect(database.$client.pragma("journal_mode", { simple: true })).toBe(
        "wal",
      );
      expect(database.$client.pragma("busy_timeout", { simple: true })).toBe(
        5000,
      );
      database.$client.exec(
        "CREATE TABLE parent (id text PRIMARY KEY); CREATE TABLE child (parent_id text REFERENCES parent(id));",
      );
      expect(() =>
        database.$client.prepare("INSERT INTO child (parent_id) VALUES (?)").run(
          "missing-parent",
        ),
      ).toThrow(/FOREIGN KEY constraint failed/);
    } finally {
      database.$client.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects an empty database instead of treating it as a compatible schema", () => {
    const database = createDatabaseClient(":memory:");
    try {
      expect(() => assertDatabaseSchema(database)).toThrow(
        "SQLite schema is incompatible",
      );
    } finally {
      database.$client.close();
    }
  });

  it("rejects an old schema marker even when the marker table exists", () => {
    const database = createDatabaseClient(":memory:");
    try {
      database.$client.exec(
        "CREATE TABLE app_schema_marker (version integer PRIMARY KEY); INSERT INTO app_schema_marker VALUES (0);",
      );
      expect(() => assertDatabaseSchema(database)).toThrow(
        "SQLite schema is incompatible",
      );
    } finally {
      database.$client.close();
    }
  });

  it("accepts the complete, versioned SQLite migration set", async () => {
    const { client, database } = await createTestDatabase();
    try {
      expect(() => assertDatabaseSchema(database)).not.toThrow();
    } finally {
      client.close();
    }
  });
});
