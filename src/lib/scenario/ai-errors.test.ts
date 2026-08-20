import { describe, expect, it } from "vitest";

import {
  classifyAiGatewayError,
  toPublicAiGatewayError,
} from "./ai-errors";

describe("classifyAiGatewayError", () => {
  it.each([
    [401, "authentication", false],
    [403, "authentication", false],
    [429, "rate_limit", true],
    [502, "upstream", true],
  ] as const)(
    "classifies HTTP %s without exposing the provider message",
    (status, kind, retryable) => {
      const result = classifyAiGatewayError(
        Object.assign(new Error("provider-secret-message"), { status }),
      );

      expect(result).toEqual({ kind, retryable, status });
      expect(JSON.stringify(result)).not.toContain("provider-secret-message");
    },
  );

  it("classifies timeout and network failures from nested causes", () => {
    const timeout = new Error("request failed", {
      cause: Object.assign(new Error("socket timeout"), {
        code: "ETIMEDOUT",
      }),
    });
    const network = Object.assign(new Error("fetch failed"), {
      code: "ECONNREFUSED",
    });

    expect(classifyAiGatewayError(timeout)).toEqual({
      kind: "timeout",
      retryable: true,
      code: "ETIMEDOUT",
    });
    expect(classifyAiGatewayError(network)).toEqual({
      kind: "network",
      retryable: true,
      code: "ECONNREFUSED",
    });
  });

  it("uses explicit provider error codes for invalid content", () => {
    expect(
      classifyAiGatewayError(
        Object.assign(new Error("empty"), {
          code: "AI_EMPTY_RESPONSE",
        }),
      ),
    ).toEqual({
      kind: "empty_response",
      retryable: true,
      code: "AI_EMPTY_RESPONSE",
    });
  });

  it("recognizes the OpenAI SDK connection wrapper", () => {
    const error = new (class APIConnectionError extends Error {}) (
      "Connection error.",
    );

    expect(classifyAiGatewayError(error)).toEqual({
      kind: "network",
      retryable: true,
    });
  });

  it.each([
    [Object.assign(new Error("gateway secret"), { code: "ETIMEDOUT" }), "AI 服务响应超时，请稍后重试。"],
    [Object.assign(new Error("gateway secret"), { code: "ECONNREFUSED" }), "AI 服务网络连接异常，请稍后重试。"],
    [Object.assign(new Error("gateway secret"), { status: 429 }), "AI 服务当前繁忙，请稍后重试。"],
    [Object.assign(new Error("gateway secret"), { status: 403 }), "AI 服务认证异常，请联系管理员。"],
    [Object.assign(new Error("gateway secret"), { code: "AI_EMPTY_RESPONSE" }), "AI 未返回有效内容，请重新发送。"],
    [Object.assign(new Error("gateway secret"), { code: "AI_INVALID_RESPONSE" }), "AI 返回结果异常，请稍后重试。"],
    [Object.assign(new Error("gateway secret"), { status: 502 }), "AI 服务暂时不可用，请稍后重试。"],
  ])("publishes a safe message for %o", (error, expected) => {
    const message = toPublicAiGatewayError(error);

    expect(message).toBe(expected);
    expect(message).not.toContain("gateway secret");
  });
});
