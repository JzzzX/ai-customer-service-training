import { afterEach, describe, expect, it } from "vitest";

import {
  assertDatabaseSchema,
  createDatabaseClient,
  type DatabaseClient,
} from "./client";
import { DEMO_USER_ID } from "@/lib/runtime/demo-identity";
import { DbScenarioTemplateStore } from "./repositories/db-scenario-template-store";
import { DbKnowledgeQueryStore } from "./repositories/db-knowledge-query-store";
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
        .prepare("select id, email, name, role, is_active from users")
        .get(),
    ).toEqual({
      id: DEMO_USER_ID,
      email: "demo@example.test",
      name: "演示学员",
      role: "learner",
      is_active: 1,
    });
  });

  it("deterministically publishes the complete topic catalog for demo practice", () => {
    database = createDatabaseClient(":memory:");
    initializeDemoDatabase(database);

    expect(
      database.$client
        .prepare("select count(*) as count from question_catalogs")
        .get(),
    ).toEqual({ count: 350 });
    expect(
      database.$client
        .prepare("select count(*) as count from quiz_sets where kind = 'topic' and status = 'published'")
        .get(),
    ).toEqual({ count: 5 });
  });

  it("publishes the original and cat mock scenarios for the full demo flow", async () => {
    database = createDatabaseClient(":memory:");
    initializeDemoDatabase(database);

    const templates = await new DbScenarioTemplateStore(database).listPublished();

    expect(templates).toHaveLength(2);
    expect(templates[0]).toMatchObject({
      id: "st_000000000000000000000001",
      versionId: "sv_000000000000000000000001",
      category: "presale",
      status: "published",
      mockMode: true,
    });
    expect(templates[1]).toMatchObject({
      id: "st_999999999999999999999999",
      versionId: "sv_888888888888888888888888",
      title: "6 个月肠胃敏感英短选粮",
      category: "presale",
      status: "published",
      mockMode: true,
      sources: [
        {
          sourcePath: "演示知识（临时）",
          kind: "markdown",
          anchor: "demo",
          path: ["演示", "售前"],
        },
      ],
    });
    expect(templates[1]?.referenceFlow.join(" ")).toMatch(
      /7天.*少量多餐.*就医.*后续跟进/,
    );
  });

  it("loads demo knowledge units with production-compatible hashes", async () => {
    database = createDatabaseClient(":memory:");
    initializeDemoDatabase(database);

    const units = await new DbKnowledgeQueryStore(database).listUnitsForScenario(
      "presale",
    );

    expect(units).toHaveLength(1);
    expect(units[0]?.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
