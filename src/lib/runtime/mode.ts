export type RuntimeMode = "sqlite";

type Environment = Record<string, string | undefined>;

export function isDemoMode(
  environment: Environment = process.env,
): boolean {
  return environment.DEMO_MODE === "true";
}

/** The learner application always uses its configured SQLite database. */
export function resolveRuntimeMode(_environment: Environment = process.env): RuntimeMode {
  void _environment;
  return "sqlite";
}
