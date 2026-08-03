export type RuntimeErrorContext = {
  route: string;
  userId?: string;
  resourceId?: string;
};

const PRIVATE_INFRASTRUCTURE_ERROR_PATTERN =
  /AI Gateway|Vercel AI|credit card|OPENAI_|ECONN|ETIMEDOUT|fetch failed|timed out|timeout/i;

export function toPublicRuntimeError(
  error: unknown,
  fallback: string,
): string {
  if (!(error instanceof Error)) {
    return fallback;
  }
  const message = error.message.trim();
  if (!message || PRIVATE_INFRASTRUCTURE_ERROR_PATTERN.test(message)) {
    return fallback;
  }
  return message;
}

export function reportRuntimeError(
  context: RuntimeErrorContext,
  error: unknown,
): void {
  const runtimeError = error instanceof Error
    ? (error as Error & {
        code?: unknown;
        status?: unknown;
        cause?: unknown;
      })
    : undefined;
  const cause = runtimeError?.cause;
  console.error({
    event: "runtime_error",
    route: context.route,
    userId: context.userId,
    resourceId: context.resourceId,
    errorClass:
      error instanceof Error
        ? error.constructor.name
        : "UnknownError",
    errorName: runtimeError?.name,
    errorCode: primitiveErrorDetail(runtimeError?.code),
    errorStatus: primitiveErrorDetail(runtimeError?.status),
    causeName: cause instanceof Error ? cause.name : undefined,
    causeCode:
      cause instanceof Error
        ? primitiveErrorDetail(
            (cause as Error & { code?: unknown }).code,
          )
        : undefined,
  });
}

function primitiveErrorDetail(
  value: unknown,
): string | number | undefined {
  return typeof value === "string" || typeof value === "number"
    ? value
    : undefined;
}
