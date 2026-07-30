export type RuntimeErrorContext = {
  route: string;
  userId?: string;
  resourceId?: string;
};

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
