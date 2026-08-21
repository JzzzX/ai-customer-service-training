// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { users } from "@/db/schema";
import { createTestDatabase } from "@/db/test-support/create-test-database";

import { checkLearnerAccess, requireAdmin, requireLearner } from "./guards";

describe("requireAdmin", () => {
  const clients: Array<{ close(): void }> = [];

  afterEach(() => {
    clients.splice(0).forEach((client) => client.close());
  });

  it("accepts an active admin after checking the live database", async () => {
    const fixture = await createTestDatabase(); clients.push(fixture.client);
    await fixture.database.insert(users).values({
      id: "admin-id",
      email: "admin@example.test",
      name: "管理员",
      passwordHash: "hash",
      role: "admin",
    });

    await expect(
      requireAdmin({
        authenticate: async () => ({
          user: { id: "admin-id", email: "admin@example.test", name: "管理员", role: "admin" },
          expires: "2099-01-01T00:00:00.000Z",
        }),
        database: fixture.database,
        deny: vi.fn(() => { throw new Error("redirected"); }),
      }),
    ).resolves.toMatchObject({ id: "admin-id", role: "admin" });
  });

  it("rejects a stale admin JWT after live database revocation", async () => {
    const fixture = await createTestDatabase(); clients.push(fixture.client);
    await fixture.database.insert(users).values({
      id: "revoked-id",
      email: "revoked@example.test",
      name: "已撤权管理员",
      passwordHash: "hash",
      role: "learner",
    });
    const deny = vi.fn(() => { throw new Error("FORBIDDEN"); });

    await expect(
      requireAdmin({
        authenticate: async () => ({
          user: { id: "revoked-id", email: "revoked@example.test", name: "已撤权管理员", role: "admin" },
          expires: "2099-01-01T00:00:00.000Z",
        }),
        database: fixture.database,
        deny,
      }),
    ).rejects.toThrow("FORBIDDEN");
    expect(deny).toHaveBeenCalledWith("/forbidden");
  });
});

describe("requireLearner", () => {
  const clients: Array<{ close(): void }> = [];
  afterEach(() => clients.splice(0).forEach((client) => client.close()));

  it("rejects an admin even when a stale route session reaches a learner mutation", async () => {
    const fixture = await createTestDatabase(); clients.push(fixture.client);
    await fixture.database.insert(users).values({ id: "admin-live", email: "admin-live@example.test", name: "管理员", passwordHash: "hash", role: "admin" });
    const deny = vi.fn(() => { throw new Error("FORBIDDEN"); });
    await expect(requireLearner({
      authenticate: async () => ({ user: { id: "admin-live", email: "admin-live@example.test", name: "管理员", role: "learner" }, expires: "2099-01-01T00:00:00.000Z" }),
      database: fixture.database,
      deny,
    })).rejects.toThrow("FORBIDDEN");
    expect(deny).toHaveBeenCalledWith("/forbidden");
  });

  it("distinguishes unauthenticated, promoted, disabled, and active learner API access", async () => {
    const fixture = await createTestDatabase(); clients.push(fixture.client);
    await fixture.database.insert(users).values([
      { id: "promoted", email: "promoted@example.test", name: "已提权", passwordHash: "hash", role: "admin", isActive: true },
      { id: "disabled", email: "disabled@example.test", name: "已停用", passwordHash: "hash", role: "learner", isActive: false },
      { id: "learner", email: "learner@example.test", name: "学员", passwordHash: "hash", role: "learner", isActive: true },
    ]);
    const session = (id: string) => ({
      user: { id, email: `${id}@example.test`, name: id, role: "learner" as const },
      expires: "2099-01-01T00:00:00.000Z",
    });

    await expect(checkLearnerAccess({ authenticate: async () => null, database: fixture.database }))
      .resolves.toEqual({ allowed: false, status: 401 });
    await expect(checkLearnerAccess({ authenticate: async () => session("promoted"), database: fixture.database }))
      .resolves.toEqual({ allowed: false, status: 403 });
    await expect(checkLearnerAccess({ authenticate: async () => session("disabled"), database: fixture.database }))
      .resolves.toEqual({ allowed: false, status: 403 });
    await expect(checkLearnerAccess({ authenticate: async () => session("learner"), database: fixture.database }))
      .resolves.toMatchObject({ allowed: true, user: { id: "learner", role: "learner" } });
  });
});
