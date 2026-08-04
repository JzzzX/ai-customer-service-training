import { hash } from "bcryptjs";
import { z } from "zod";

import { resolveRuntimeMode } from "@/lib/runtime/mode";

import type { StoredUserAccount, UserRole } from "./credentials";

type Environment = Record<string, string | undefined>;

const localAccountEnvironmentSchema = z
  .object({
    SEED_ADMIN_EMAIL: z.string().trim().toLowerCase().email(),
    SEED_ADMIN_NAME: z.string().trim().min(1),
    SEED_ADMIN_PASSWORD: z.string().min(1),
    SEED_LEARNER_EMAIL: z.string().trim().toLowerCase().email(),
    SEED_LEARNER_NAME: z.string().trim().min(1),
    SEED_LEARNER_PASSWORD: z.string().min(1),
  })
  .refine(
    (value) => value.SEED_ADMIN_EMAIL !== value.SEED_LEARNER_EMAIL,
    "管理员与学员邮箱不能相同",
  );

export function shouldUseLocalTestAccounts(
  environment: Environment = process.env,
  nodeEnvironment = process.env.NODE_ENV,
): boolean {
  return (
    resolveRuntimeMode({
      ...environment,
      NODE_ENV: nodeEnvironment,
    }) === "local_demo"
  );
}

export async function findLocalTestUserByEmail(
  email: string,
  environment: Environment = process.env,
  nodeEnvironment = process.env.NODE_ENV,
): Promise<StoredUserAccount | null> {
  if (!shouldUseLocalTestAccounts(environment, nodeEnvironment)) {
    return null;
  }

  const parsed = localAccountEnvironmentSchema.safeParse(environment);
  if (!parsed.success) {
    throw new Error(
      `本地测试账号配置不完整：${parsed.error.issues
        .map((issue) => issue.path.join(".") || issue.message)
        .join("、")}`,
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  const config = parsed.data;
  const matchingAccount =
    normalizedEmail === config.SEED_ADMIN_EMAIL
      ? {
          id: "00000000-0000-4000-8000-000000000001",
          email: config.SEED_ADMIN_EMAIL,
          name: config.SEED_ADMIN_NAME,
          password: config.SEED_ADMIN_PASSWORD,
          role: "admin" as UserRole,
        }
      : normalizedEmail === config.SEED_LEARNER_EMAIL
        ? {
            id: "00000000-0000-4000-8000-000000000002",
            email: config.SEED_LEARNER_EMAIL,
            name: config.SEED_LEARNER_NAME,
            password: config.SEED_LEARNER_PASSWORD,
            role: "learner" as UserRole,
          }
        : null;

  if (!matchingAccount) {
    return null;
  }

  return {
    id: matchingAccount.id,
    email: matchingAccount.email,
    name: matchingAccount.name,
    passwordHash: await hash(matchingAccount.password, 4),
    role: matchingAccount.role,
    isActive: true,
  };
}
