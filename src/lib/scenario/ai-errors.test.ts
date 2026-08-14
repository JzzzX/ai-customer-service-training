import { describe, expect, it } from "vitest";

import { classifyAiGatewayError } from "./ai-errors";

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
});
