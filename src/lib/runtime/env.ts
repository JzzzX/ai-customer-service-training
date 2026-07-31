import { z } from "zod";

import { resolveRuntimeMode, type RuntimeMode } from "./mode";

type Environment = Record<string, string | undefined>;

export const productionEnvironmentSchema = z
  .object({
    DATABASE_URL: z
      .string()
      .url()
      .startsWith("postgresql://"),
    AUTH_SECRET: z.string().min(32),
    LOCAL_TEST_AUTH_ENABLED: z.literal("false").optional(),
    SCENARIO_AI_MODE: z.enum(["mock", "real"]).optional(),
    OPENAI_API_KEY: z.string().min(1).optional(),
    OPENAI_BASE_URL: z.string().url().optional(),
    OPENAI_MODEL: z.string().min(1).optional(),
    AI_GATEWAY_ENABLED: z.literal("true").optional(),
    AI_GATEWAY_MODEL: z.string().min(1).optional(),
  })
  .superRefine((environment, context) => {
    if (environment.SCENARIO_AI_MODE !== "real") {
      return;
    }
    const requiredFields = environment.AI_GATEWAY_ENABLED
      ? (["AI_GATEWAY_MODEL"] as const)
      : ([
          "OPENAI_API_KEY",
          "OPENAI_BASE_URL",
          "OPENAI_MODEL",
        ] as const);
    for (const field of requiredFields) {
      if (!environment[field]) {
        context.addIssue({
          code: "custom",
          message: `${field} is required in real AI mode`,
          path: [field],
        });
      }
    }
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
