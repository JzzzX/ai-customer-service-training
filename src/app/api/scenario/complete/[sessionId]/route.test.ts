import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionId = "11111111-1111-4111-8111-111111111111";
const learnerId = "22222222-2222-4222-8222-222222222222";

const mocks = vi.hoisted(() => ({
  learnerId: "22222222-2222-4222-8222-222222222222",
  reportRuntimeError: vi.fn(),
  completeStream: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: mocks.learnerId } }),
}));
vi.mock("@/lib/runtime/services", () => ({
  getScenarioTrainingService: () => ({
    completeStream: mocks.completeStream,
  }),
}));
vi.mock("@/lib/runtime/errors", () => ({
  reportRuntimeError: mocks.reportRuntimeError,
  toPublicRuntimeError: (_error: unknown, fallback: string) => fallback,
}));

import { GET } from "./route";

describe("GET /api/scenario/complete/:sessionId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.completeStream.mockImplementation(async function* () {
      throw Object.assign(new Error("upstream secret detail"), { status: 502 });
    });
  });

  it("passes the client disconnect signal into report generation", async () => {
    const abort = new AbortController();
    mocks.completeStream.mockImplementationOnce(async function* () {
      yield { phase: "analyzing" };
    });
    const request = new Request("http://localhost", { signal: abort.signal });

    const response = await GET(request, {
      params: Promise.resolve({ sessionId }),
    });
    await response.text();

    expect(mocks.completeStream).toHaveBeenCalledWith(
      expect.objectContaining({
        learnerId,
        sessionId,
        signal: expect.any(AbortSignal),
      }),
    );
    const input = mocks.completeStream.mock.calls[0]?.[0] as {
      signal: AbortSignal;
    };
    abort.abort();
    expect(input.signal.aborted).toBe(true);
  });

  it("emits a heartbeat every 15 seconds while report evaluation is pending", async () => {
    vi.useFakeTimers();
    let finish = () => {};
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    mocks.completeStream.mockImplementationOnce(async function* () {
      yield { phase: "analyzing" };
      await pending;
    });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ sessionId }),
    });
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    expect(decoder.decode((await reader?.read())?.value)).toContain(
      ": stream-open",
    );
    expect(decoder.decode((await reader?.read())?.value)).toContain(
      '"phase":"analyzing"',
    );

    const nextChunk = reader?.read().then((result) =>
      decoder.decode(result.value),
    );
    const missingHeartbeat = new Promise<string>((resolve) => {
      setTimeout(() => resolve("missing heartbeat"), 15_001);
    });
    await vi.advanceTimersByTimeAsync(15_001);

    await expect(Promise.race([nextChunk, missingHeartbeat])).resolves.toContain(
      ": heartbeat",
    );

    finish();
    await reader?.cancel();
    vi.useRealTimers();
  });

  it("stops quietly when the client disconnects", async () => {
    mocks.completeStream.mockImplementationOnce(async function* (input: {
      signal: AbortSignal;
    }) {
      yield { phase: "analyzing" };
      await new Promise<never>((_resolve, reject) => {
        input.signal.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });
    const abort = new AbortController();
    const response = await GET(
      new Request("http://localhost", { signal: abort.signal }),
      { params: Promise.resolve({ sessionId }) },
    );
    const reader = response.body?.getReader();
    await reader?.read();
    await reader?.read();

    abort.abort();

    await expect(reader?.read()).resolves.toMatchObject({ done: true });
    expect(mocks.reportRuntimeError).not.toHaveBeenCalled();
  });

  it("classifies and logs report gateway failures without exposing details", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ sessionId }),
    });
    const body = await response.text();

    expect(body).toContain("AI 服务暂时不可用，请稍后重试。");
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

  it("returns a classified and redacted authentication failure", async () => {
    mocks.completeStream.mockImplementationOnce(async function* () {
      throw Object.assign(new Error("gateway credential: top-secret"), {
        status: 403,
      });
    });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ sessionId }),
    });
    const body = await response.text();

    expect(body).toContain("AI 服务认证异常，请联系管理员。");
    expect(body).not.toContain("top-secret");
  });
});
