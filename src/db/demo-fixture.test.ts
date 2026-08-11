import { afterEach, describe, expect, it } from "vitest";

import {
  assertDatabaseSchema,
  createDatabaseClient,
  type DatabaseClient,
} from "./client";
import { DEMO_USER_ID } from "@/lib/runtime/demo-identity";
import { DbScenarioTemplateStore } from "./repositories/db-scenario-template-store";
import { initializeDemoDatabase } from "./demo-fixture";

describe("in-memory demo fixture", () => {
  let database: DatabaseClient | undefined;

  afterEach(() => {
    database?.$client.close();
    database = undefined;
  });

  it("creates a valid SQLite schema with an active demo learner", () => {
    database = createDatabaseClient(":memory:");
    initializeDemoDatabase(database);

    expect(() => assertDatabaseSchema(database!)).not.toThrow();
    expect(
      database.$client
        .prepare("select id, email, name, is_active from users")
        .get(),
    ).toEqual({
      id: DEMO_USER_ID,
      email: "demo@example.test",
      name: "演示学员",
      is_active: 1,
    });
  });

  it("publishes one mock scenario for the full demo flow", async () => {
    database = createDatabaseClient(":memory:");
    initializeDemoDatabase(database);

    const templates = await new DbScenarioTemplateStore(database).listPublished();

    expect(templates).toHaveLength(1);
    expect(templates[0]).toMatchObject({
      id: "st_000000000000000000000001",
      versionId: "sv_000000000000000000000001",
      category: "presale",
      status: "published",
      mockMode: true,
    });
  });
});
