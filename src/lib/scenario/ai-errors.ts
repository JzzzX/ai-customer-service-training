export type AiGatewayErrorKind =
  | "authentication"
  | "rate_limit"
  | "timeout"
  | "upstream"
  | "empty_response"
  | "invalid_response"
  | "network"
  | "unknown";

export type AiGatewayErrorClassification = {
  kind: AiGatewayErrorKind;
  retryable: boolean;
  status?: number;
  code?: string;
};

const NETWORK_CODES = new Set([
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "ENETUNREACH",
  "ENOTFOUND",
]);

export function classifyAiGatewayError(
  error: unknown,
): AiGatewayErrorClassification {
  const details = errorDetails(error);
  const status = details.status;
  const code = details.code;

  if (code === "AI_EMPTY_RESPONSE") {
    return { kind: "empty_response", retryable: true, code };
  }
  if (code === "AI_INVALID_RESPONSE" || code === "AI_DUPLICATE_RESPONSE") {
    return { kind: "invalid_response", retryable: true, code };
  }
  if (code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT") {
    return { kind: "timeout", retryable: true, code };
  }
  if (
    details.name === "APIConnectionTimeoutError" ||
    details.constructorName === "APIConnectionTimeoutError"
  ) {
    return { kind: "timeout", retryable: true };
  }
  if (code && NETWORK_CODES.has(code)) {
    return { kind: "network", retryable: true, code };
  }
  if (
    details.name === "APIConnectionError" ||
    details.constructorName === "APIConnectionError"
  ) {
    return { kind: "network", retryable: true };
  }
  if (status === 401 || status === 403) {
    return { kind: "authentication", retryable: false, status };
  }
  if (status === 408 || status === 504) {
    return { kind: "timeout", retryable: true, status };
  }
  if (status === 429) {
    return { kind: "rate_limit", retryable: true, status };
  }
  if (status !== undefined && status >= 500) {
    return { kind: "upstream", retryable: true, status };
  }
  return {
    kind: "unknown",
    retryable: false,
    ...(status !== undefined ? { status } : {}),
    ...(code ? { code } : {}),
  };
}

function errorDetails(error: unknown): {
  status?: number;
  code?: string;
  constructorName?: string;
  name?: string;
} {
  if (!(error instanceof Error)) {
    return {};
  }
  const candidate = error as Error & {
    status?: unknown;
    code?: unknown;
    cause?: unknown;
  };
  const cause = candidate.cause;
  const causeCode =
    cause instanceof Error
      ? (cause as Error & { code?: unknown }).code
      : undefined;
  return {
    constructorName: candidate.constructor.name,
    name: candidate.name,
    ...(typeof candidate.status === "number"
      ? { status: candidate.status }
      : {}),
    ...(typeof candidate.code === "string"
      ? { code: candidate.code }
      : typeof causeCode === "string"
        ? { code: causeCode }
        : {}),
  };
}
