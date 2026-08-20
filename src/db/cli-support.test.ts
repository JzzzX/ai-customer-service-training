import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { backupDatabase, disableLearner, grantAdmin, importLearners, parseLearnerCsv, resetLearnerPassword, revokeAdmin } from "../../scripts/cli-support";
import { users } from "./schema";
import { createTestDatabase } from "./test-support/create-test-database";
import { assertDatabaseSchema, createDatabaseClient } from "./client";

describe("learner CLI support", () => {
  const clients: Array<{ close(): void }> = [];
  afterEach(() => clients.splice(0).forEach((client) => client.close()));

  it("imports normalized accounts idempotently and preserves omitted password", async () => {
    const fixture = await createTestDatabase(); clients.push(fixture.client);
    const rows = parseLearnerCsv("email,name,password,is_active\n A@Example.com ,阿甲,password88,true\n");
    expect(await importLearners(rows, fixture.database)).toEqual({ created: 1, updated: 0 });
    const first = fixture.database.select().from(users).where(eq(users.email, "a@example.com")).get();
    expect(first).toBeDefined();
    expect(await importLearners(parseLearnerCsv("email,name,password,is_active\na@example.com,新名字,,false\n"), fixture.database)).toEqual({ created: 0, updated: 1 });
    const second = fixture.database.select().from(users).where(eq(users.email, "a@example.com")).get();
    expect(second?.name).toBe("新名字"); expect(second?.isActive).toBe(false); expect(second?.passwordHash).toBe(first?.passwordHash);
  });

  it("rolls back invalid new account and supports disable/reset", async () => {
    const fixture = await createTestDatabase(); clients.push(fixture.client);
    await expect(importLearners(parseLearnerCsv("email,name,password,is_active\na@example.com,阿甲,password88,true\nb@example.com,阿乙,,true\n"), fixture.database)).rejects.toThrow("新学员");
    expect(fixture.database.select().from(users).all()).toEqual([]);
    await importLearners(parseLearnerCsv("email,name,password,is_active\na@example.com,阿甲,password88,true\n"), fixture.database);
    expect(disableLearner("A@EXAMPLE.COM", fixture.database)).toBe(true);
    expect(await resetLearnerPassword("a@example.com", "freshpass99", fixture.database)).toBe(true);
    const account = fixture.database.select().from(users).where(eq(users.email, "a@example.com")).get();
    expect(account?.isActive).toBe(false); expect(await compare("freshpass99", account!.passwordHash)).toBe(true);
  });

  it("rejects invalid CSV input", () => {
    expect(() => parseLearnerCsv("email,name,password,is_active\na@example.com,阿甲,password88,yes\n")).toThrow("is_active");
    expect(() => parseLearnerCsv("email,name,password,is_active\na@example.com,阿甲,password88,true\nA@example.com,阿乙,password99,true\n")).toThrow("重复邮箱");
  });

  it("grants and revokes admin by normalized company email", async () => {
    const fixture = await createTestDatabase(); clients.push(fixture.client);
    await importLearners(
      parseLearnerCsv("email,name,password,is_active\nadmin@example.com,管理员,password88,true\n"),
      fixture.database,
    );

    expect(grantAdmin(" ADMIN@EXAMPLE.COM ", fixture.database)).toBe(true);
    expect(
      fixture.database.select().from(users).where(eq(users.email, "admin@example.com")).get()?.role,
    ).toBe("admin");
    expect(revokeAdmin("Admin@example.com", fixture.database)).toBe(true);
    expect(
      fixture.database.select().from(users).where(eq(users.email, "admin@example.com")).get()?.role,
    ).toBe("learner");
    expect(grantAdmin("missing@example.com", fixture.database)).toBe(false);
  });

  it("backs up a valid SQLite file and refuses to overwrite it", async () => {
    const fixture = await createTestDatabase(); clients.push(fixture.client);
    const directory = await mkdtemp(join(tmpdir(), "ai-training-backup-"));
    const output = join(directory, "training.sqlite");
    try {
      await backupDatabase(output, fixture.database);
      expect(existsSync(output)).toBe(true);
      const copied = createDatabaseClient(output);
      try { expect(() => assertDatabaseSchema(copied)).not.toThrow(); } finally { copied.$client.close(); }
      await expect(backupDatabase(output, fixture.database)).rejects.toThrow("已存在");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
