import { z } from "zod";

import { resolveRuntimeMode, type RuntimeMode } from "./mode";

type Environment = Record<string, string | undefined>;

export const productionEnvironmentSchema = z
  .object({
    SQLITE_PATH: z.string().trim().min(1).optional(),
    AUTH_SECRET: z.string().min(32),
    FEISHU_APP_CLIENT_ID: z.string().trim().min(1).optional(),
    FEISHU_APP_CLIENT_SECRET: z.string().trim().min(1).optional(),
    DEMO_MODE: z.enum(["true", "false"]).optional(),
    SCENARIO_AI_MODE: z.enum(["mock", "real"]).optional(),
    OPENAI_API_KEY: z.string().min(1).optional(),
    OPENAI_BASE_URL: z.string().url().optional(),
    OPENAI_MODEL: z.string().min(1).optional(),
    AI_GATEWAY_ENABLED: z.enum(["true", "false"]).optional(),
    AI_GATEWAY_MODEL: z.string().min(1).optional(),
  })
  .superRefine((environment, context) => {
    if (environment.DEMO_MODE !== "true") {
      if (!environment.SQLITE_PATH) {
        context.addIssue({
          code: "custom",
          message: "SQLITE_PATH is required outside demo mode",
          path: ["SQLITE_PATH"],
        });
      }

      for (const field of [
        "FEISHU_APP_CLIENT_ID",
        "FEISHU_APP_CLIENT_SECRET",
      ] as const) {
        if (!environment[field]) {
          context.addIssue({
            code: "custom",
            message: `${field} is required outside demo mode`,
            path: [field],
          });
        }
      }
    }

    if (environment.SCENARIO_AI_MODE !== "real") {
      return;
    }
    const requiredFields = environment.AI_GATEWAY_ENABLED === "true"
      ? (["AI_GATEWAY_MODEL"] as const)
      : (["OPENAI_API_KEY", "OPENAI_BASE_URL", "OPENAI_MODEL"] as const);
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
