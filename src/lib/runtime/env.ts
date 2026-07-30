import { z } from "zod";

import { resolveRuntimeMode, type RuntimeMode } from "./mode";

type Environment = Record<string, string | undefined>;

export const productionEnvironmentSchema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .startsWith("postgresql://"),
  AUTH_SECRET: z.string().min(32),
  LOCAL_TEST_AUTH_ENABLED: z.literal("false").optional(),
  SCENARIO_AI_MODE: z.enum(["mock", "real"]).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_BASE_URL: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).optional(),
});

export function validateRuntimeEnvironment(
  environment: Environment = process.env,
  nodeEnvironment = process.env.NODE_ENV,
): { mode: RuntimeMode } {
  const mode = resolveRuntimeMode({
    ...environment,
    NODE_ENV: nodeEnvironment,
  });
  if (nodeEnvironment !== "production") {
    return { mode };
  }

  const parsed = productionEnvironmentSchema.safeParse(environment);
  if (!parsed.success) {
    const invalidFields = [
      ...new Set(
        parsed.error.issues.map(
          (issue) => issue.path[0]?.toString() ?? "environment",
        ),
      ),
    ].join("、");
    throw new Error(`生产环境配置无效：${invalidFields}`);
  }
  return { mode };
}
