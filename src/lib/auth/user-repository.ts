import { and, eq } from "drizzle-orm";

import { getDatabase } from "@/db/client";
import { users } from "@/db/schema";

import type { StoredUserAccount } from "./credentials";
import {
  findLocalTestUserByEmail,
  shouldUseLocalTestAccounts,
} from "./local-test-accounts";

export async function findUserByEmail(
  email: string,
): Promise<StoredUserAccount | null> {
  if (shouldUseLocalTestAccounts()) {
    return findLocalTestUserByEmail(email);
  }

  const database = getDatabase();
  const account = await database.query.users.findFirst({
    columns: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      isActive: true,
    },
    where: and(eq(users.email, email), eq(users.role, "learner")),
  });

  return account ?? null;
}
