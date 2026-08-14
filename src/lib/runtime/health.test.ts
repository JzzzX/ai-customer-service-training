import { describe, expect, it } from "vitest";

import { createTestDatabase } from "@/db/test-support/create-test-database";
import { checkApplicationReadiness } from "./health";

describe("checkApplicationReadiness", () => {
  it("verifies the SQLite schema and reports the configured AI mode", async () => {
    const { client, database } = await createTestDatabase();
    try {
      expect(
        checkApplicationReadiness({
          databaseFactory: () => database,
          environment: { SCENARIO_AI_MODE: "real" },
          nodeEnvironment: "test",
        }),
      ).toEqual({ aiMode: "real", database: "ready", ok: true });
    } finally {
      client.close();
    }
  });

  it("fails when the database schema is not ready", () => {
    expect(() =>
      checkApplicationReadiness({
        databaseFactory: () => ({
          $client: { prepare: () => ({ get: () => undefined }) },
        }) as never,
        environment: {},
        nodeEnvironment: "test",
      }),
    ).toThrow("SQLite schema is incompatible");
  });
});
