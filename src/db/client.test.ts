import { describe, expect, it } from "vitest";

import { createDatabaseClient, requireDatabaseUrl } from "./client";

describe("Neon database client", () => {
  it("fails clearly when DATABASE_URL is unavailable", () => {
    expect(() => requireDatabaseUrl({})).toThrow(
      "DATABASE_URL must be a Neon PostgreSQL connection string",
    );
    expect(() => requireDatabaseUrl({ DATABASE_URL: "  " })).toThrow(
      "DATABASE_URL must be a Neon PostgreSQL connection string",
    );
  });

  it("creates a lazy Neon HTTP client without opening a connection", () => {
    const databaseUrl =
      "postgresql://training:test@example.neon.tech/training?sslmode=require";

    expect(requireDatabaseUrl({ DATABASE_URL: databaseUrl })).toBe(databaseUrl);
    expect(createDatabaseClient(databaseUrl)).toBeDefined();
  });
});
