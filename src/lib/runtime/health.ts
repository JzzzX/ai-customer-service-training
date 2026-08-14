import {
  assertDatabaseSchema,
  getDatabase,
  type DatabaseClient,
} from "@/db/client";
import { resolveScenarioAiMode } from "@/lib/scenario/ai-client";

import { validateRuntimeEnvironment } from "./env";

type Environment = Record<string, string | undefined>;
type NodeEnvironment = "development" | "production" | "test" | undefined;

type ReadinessDependencies = {
  databaseFactory?: () => DatabaseClient;
  environment?: Environment;
  nodeEnvironment?: NodeEnvironment;
};

export type ApplicationReadiness = {
  aiMode: "mock" | "real";
  database: "ready";
  ok: true;
};

export function checkApplicationReadiness(
  dependencies: ReadinessDependencies = {},
): ApplicationReadiness {
  const environment = dependencies.environment ?? process.env;
  const nodeEnvironment =
    dependencies.nodeEnvironment ?? process.env.NODE_ENV;
  const databaseFactory = dependencies.databaseFactory ?? getDatabase;

  validateRuntimeEnvironment(environment, nodeEnvironment);
  const database = databaseFactory();
  assertDatabaseSchema(database);
  database.$client.prepare("SELECT 1").get();

  return {
    aiMode: resolveScenarioAiMode(environment),
    database: "ready",
    ok: true,
  };
}
