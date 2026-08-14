import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkApplicationReadiness: vi.fn(),
}));

vi.mock("@/lib/runtime/health", () => ({
  checkApplicationReadiness: mocks.checkApplicationReadiness,
}));

import { GET } from "./route";

describe("GET /api/ready", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns safe readiness metadata without calling the AI provider", async () => {
    mocks.checkApplicationReadiness.mockReturnValue({
      aiMode: "real",
      database: "ready",
      ok: true,
    });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      aiMode: "real",
      database: "ready",
      ok: true,
    });
  });

  it("returns 503 without exposing the readiness exception", async () => {
    mocks.checkApplicationReadiness.mockImplementation(() => {
      throw new Error("database path /private/secret.sqlite failed");
    });

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false });
  });
});
