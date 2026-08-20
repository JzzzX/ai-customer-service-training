// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { users } from "@/db/schema";
import { createTestDatabase } from "@/db/test-support/create-test-database";

import { requireAdmin } from "./guards";

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
