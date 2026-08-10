export type RuntimeMode = "local_demo" | "production";

type Environment = Record<string, string | undefined>;

export function resolveRuntimeMode(
  environment: Environment = process.env,
): RuntimeMode {
  const nodeEnvironment = environment.NODE_ENV?.trim().toLowerCase();
  const localRequested =
    environment.LOCAL_TEST_AUTH_ENABLED?.trim().toLowerCase() === "true";
  const hasDatabase = Boolean(environment.DATABASE_URL?.trim());

  return nodeEnvironment !== "production" &&
    localRequested &&
    !hasDatabase
    ? "local_demo"
    : "production";
}
