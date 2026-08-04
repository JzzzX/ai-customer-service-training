import { z } from "zod";

import type { UserRole } from "@/lib/auth/credentials";

type SeedEnvironment = Record<string, string | undefined>;

export interface SeedAccount {
  email: string;
  name: string;
  password: string;
  role: UserRole;
}

const seedAccountSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1),
  password: z.string().min(8),
  role: z.enum(["admin", "learner"]),
});

export function readSeedAccounts(
  environment: SeedEnvironment = process.env,
): SeedAccount[] {
  return [
    seedAccountSchema.parse({
      email: required(environment, "SEED_ADMIN_EMAIL"),
      name: required(environment, "SEED_ADMIN_NAME"),
      password: required(environment, "SEED_ADMIN_PASSWORD"),
      role: "admin",
    }),
    seedAccountSchema.parse({
      email: required(environment, "SEED_LEARNER_EMAIL"),
      name: required(environment, "SEED_LEARNER_NAME"),
      password: required(environment, "SEED_LEARNER_PASSWORD"),
      role: "learner",
    }),
  ];
}

function required(environment: SeedEnvironment, key: string): string {
  const value = environment[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required to seed test accounts.`);
  }

  return value;
}
