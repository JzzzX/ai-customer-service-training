export type RuntimeErrorContext = {
  route: string;
  userId?: string;
  resourceId?: string;
};

const PRIVATE_INFRASTRUCTURE_ERROR_PATTERN =
  /AI Gateway|Vercel AI|credit card|OPENAI_|ECONN|ETIMEDOUT|fetch failed|timeout/i;

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
  console.error({
    event: "runtime_error",
    route: context.route,
    userId: context.userId,
    resourceId: context.resourceId,
    errorClass:
      error instanceof Error
        ? error.constructor.name
        : "UnknownError",
  });
}
