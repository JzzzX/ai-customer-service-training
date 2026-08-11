import { describe, expect, it, vi } from "vitest";

describe("demo database runtime sharing", () => {
  it("shares the in-memory database across independently loaded modules", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    vi.resetModules();
    const firstClient = await import("./client");
    const firstDatabase = firstClient.getDatabase();

    vi.resetModules();
    const secondClient = await import("./client");
    const secondDatabase = secondClient.getDatabase();

    expect(secondDatabase.$client).toBe(firstDatabase.$client);
    vi.unstubAllEnvs();
  });
});
