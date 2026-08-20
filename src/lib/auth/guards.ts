import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { getDatabase, type DatabaseClient } from "@/db/client";
import { users } from "@/db/schema";

export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return session.user;
}

type AdminGuardSession = Session | null;

type RequireAdminDependencies = {
  authenticate?: () => Promise<AdminGuardSession>;
  database?: DatabaseClient;
  deny?: (path: string) => never;
};

export async function requireAdmin(
  dependencies: RequireAdminDependencies = {},
) {
  const authenticate = dependencies.authenticate ?? (() => auth());
  const deny = dependencies.deny ?? redirect;
  const session = await authenticate();
  if (!session?.user) {
    return deny("/login");
  }

  const database = dependencies.database ?? getDatabase();
  const liveAdmin = database
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(
      and(
        eq(users.id, session.user.id),
        eq(users.isActive, true),
        eq(users.role, "admin"),
      ),
    )
    .get();
  if (!liveAdmin) {
    return deny("/forbidden");
  }

  return { ...session.user, role: liveAdmin.role };
}
