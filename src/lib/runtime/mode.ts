export type RuntimeMode = "sqlite";

type Environment = Record<string, string | undefined>;

/** The learner application always uses its configured SQLite database. */
export function resolveRuntimeMode(_environment: Environment = process.env): RuntimeMode {
  void _environment;
  return "sqlite";
}
