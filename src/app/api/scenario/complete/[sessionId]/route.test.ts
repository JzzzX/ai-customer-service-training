import { describe, expect, it, vi } from "vitest";

const sessionId = "11111111-1111-4111-8111-111111111111";
const learnerId = "22222222-2222-4222-8222-222222222222";

const mocks = vi.hoisted(() => ({
  learnerId: "22222222-2222-4222-8222-222222222222",
  reportRuntimeError: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: mocks.learnerId } }),
}));
vi.mock("@/lib/runtime/services", () => ({
  getScenarioTrainingService: () => ({
    async *completeStream() {
      throw Object.assign(new Error("upstream secret detail"), { status: 502 });
    },
  }),
}));
vi.mock("@/lib/runtime/errors", () => ({
  reportRuntimeError: mocks.reportRuntimeError,
  toPublicRuntimeError: (_error: unknown, fallback: string) => fallback,
}));

import { GET } from "./route";

describe("GET /api/scenario/complete/:sessionId", () => {
  it("classifies and logs report gateway failures without exposing details", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ sessionId }),
    });
    const body = await response.text();

    expect(body).toContain("AI 评测服务暂时不可用，请稍后重试。");
    expect(body).not.toContain("upstream secret detail");
    expect(mocks.reportRuntimeError).toHaveBeenCalledWith(
      {
        errorCategory: "upstream",
        operation: "complete_session",
        route: "/api/scenario/complete",
        userId: learnerId,
        resourceId: sessionId,
      },
      expect.any(Error),
    );
  });
});
