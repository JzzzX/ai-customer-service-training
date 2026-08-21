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

export type LearnerAccess =
  | { allowed: true; user: NonNullable<Session["user"]> & { role: "learner" } }
  | { allowed: false; status: 401 | 403 };

export async function checkLearnerAccess(
  dependencies: Omit<RequireAdminDependencies, "deny"> = {},
): Promise<LearnerAccess> {
  const authenticate = dependencies.authenticate ?? (() => auth());
  const session = await authenticate();
  if (!session?.user) return { allowed: false, status: 401 };

  const database = dependencies.database ?? getDatabase();
  const liveLearner = database.select({ id: users.id, role: users.role }).from(users).where(and(
    eq(users.id, session.user.id), eq(users.isActive, true), eq(users.role, "learner"),
  )).get();
  if (!liveLearner) return { allowed: false, status: 403 };
  return { allowed: true, user: { ...session.user, role: "learner" } };
}

export async function requireLearner(
  dependencies: RequireAdminDependencies = {},
) {
  const deny = dependencies.deny ?? redirect;
  const access = await checkLearnerAccess(dependencies);
  if (!access.allowed) return deny(access.status === 401 ? "/login" : "/forbidden");
  return access.user;
}

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
