import { eq } from "drizzle-orm";

import { getDatabase } from "@/db/client";
import { users } from "@/db/schema";

import type { StoredUserAccount } from "./credentials";

export async function findUserByEmail(
  email: string,
): Promise<StoredUserAccount | null> {
  const database = getDatabase();
  const account = await database.query.users.findFirst({
    columns: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      role: true,
      isActive: true,
    },
    where: eq(users.email, email),
  });

  return account ?? null;
}
