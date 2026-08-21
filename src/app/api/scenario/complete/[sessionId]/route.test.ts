import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionId = "11111111-1111-4111-8111-111111111111";
const learnerId = "22222222-2222-4222-8222-222222222222";

const mocks = vi.hoisted(() => ({
  learnerId: "22222222-2222-4222-8222-222222222222",
  reportRuntimeError: vi.fn(),
  completeStream: vi.fn(),
  checkLearnerAccess: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  checkLearnerAccess: mocks.checkLearnerAccess,
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
    mocks.checkLearnerAccess.mockResolvedValue({
      allowed: true,
      user: { id: mocks.learnerId, role: "learner" },
    });
    mocks.completeStream.mockImplementation(async function* () {
      throw Object.assign(new Error("upstream secret detail"), { status: 502 });
    });
  });

  it.each([
    [401, "未登录，请先登录。"],
    [403, "当前账号无权进行练习。"],
  ])("returns %s before starting report work when live learner access is denied", async (status, message) => {
    mocks.checkLearnerAccess.mockResolvedValueOnce({ allowed: false, status });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ sessionId }),
    });

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error: message });
    expect(mocks.completeStream).not.toHaveBeenCalled();
  });

  it("propagates a Request.signal abort to report generation", async () => {
    const abort = new AbortController();
    let observedSignal: AbortSignal | undefined;
    mocks.completeStream.mockImplementationOnce(async function* (input: {
      signal: AbortSignal;
    }) {
      observedSignal = input.signal;
      yield { phase: "analyzing" };
      await new Promise<void>((resolve) => {
        input.signal.addEventListener("abort", () => resolve(), { once: true });
      });
    });
    const request = new Request("http://localhost", { signal: abort.signal });

    const response = await GET(request, {
      params: Promise.resolve({ sessionId }),
    });
    const reader = response.body?.getReader();
    await reader?.read();
    await reader?.read();

    expect(mocks.completeStream).toHaveBeenCalledWith(
      expect.objectContaining({
        learnerId,
        sessionId,
        signal: expect.any(AbortSignal),
      }),
    );
    expect(observedSignal).not.toBe(abort.signal);

    abort.abort();

    expect(observedSignal?.aborted).toBe(true);
    await expect(reader?.read()).resolves.toMatchObject({ done: true });
  });

  it("does not start report work or a heartbeat for a pre-aborted request", async () => {
    vi.useFakeTimers();
    try {
      const abort = new AbortController();
      abort.abort();

      const response = await GET(
        new Request("http://localhost", { signal: abort.signal }),
        { params: Promise.resolve({ sessionId }) },
      );
      const reader = response.body?.getReader();

      expect(mocks.completeStream).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
      await expect(reader?.read()).resolves.toMatchObject({ done: true });
      expect(mocks.reportRuntimeError).not.toHaveBeenCalled();
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
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
    vi.useFakeTimers();
    let finish = () => {};
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    mocks.completeStream.mockImplementationOnce(async function* () {
      yield { phase: "analyzing" };
      await pending;
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

    expect(vi.getTimerCount()).toBe(0);
    finish();
    await expect(reader?.read()).resolves.toMatchObject({ done: true });
    expect(mocks.reportRuntimeError).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("aborts pending report generation and clears its heartbeat when the reader cancels", async () => {
    vi.useFakeTimers();
    let observedSignal: AbortSignal | undefined;
    let upstreamStopped = () => {};
    const stopped = new Promise<void>((resolve) => {
      upstreamStopped = resolve;
    });
    mocks.completeStream.mockImplementationOnce(async function* (input: {
      signal: AbortSignal;
    }) {
      observedSignal = input.signal;
      yield { phase: "analyzing" };
      await new Promise<void>((resolve) => {
        input.signal.addEventListener("abort", () => resolve(), { once: true });
      });
      upstreamStopped();
    });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ sessionId }),
    });
    const reader = response.body?.getReader();
    await reader?.read();
    await reader?.read();

    await reader?.cancel();
    await stopped;
    await vi.advanceTimersByTimeAsync(15_000);

    expect(observedSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(mocks.reportRuntimeError).not.toHaveBeenCalled();
    vi.useRealTimers();
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

  it.each([
    ["AI_EMPTY_RESPONSE", "empty_response", "AI 未返回有效内容，请重新发送。"],
    ["AI_INVALID_RESPONSE", "invalid_response", "AI 返回结果异常，请稍后重试。"],
  ])("classifies %s and sends only its redacted SSE message", async (code, errorCategory, publicMessage) => {
    mocks.completeStream.mockImplementationOnce(async function* () {
      throw Object.assign(new Error("private malformed payload"), { code });
    });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ sessionId }),
    });
    const body = await response.text();

    expect(body).toContain(publicMessage);
    expect(body).not.toContain("private malformed payload");
    expect(mocks.reportRuntimeError).toHaveBeenCalledWith(
      expect.objectContaining({ errorCategory }),
      expect.any(Error),
    );
  });
});
