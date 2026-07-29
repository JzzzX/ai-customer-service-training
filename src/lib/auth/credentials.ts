import { compare } from "bcryptjs";
import { z } from "zod";

export type UserRole = "admin" | "learner";

export interface StoredUserAccount {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

type FindUserByEmail = (
  email: string,
) => Promise<StoredUserAccount | null | undefined>;

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export async function authenticateCredentials(
  credentials: Record<string, unknown> | undefined,
  findUserByEmail: FindUserByEmail,
): Promise<SessionUser | null> {
  const parsed = credentialsSchema.safeParse(credentials);
  if (!parsed.success) {
    return null;
  }

  const account = await findUserByEmail(parsed.data.email);
  if (
    !account ||
    !account.isActive ||
    !(await compare(parsed.data.password, account.passwordHash))
  ) {
    return null;
  }

  return {
    id: account.id,
    email: account.email,
    name: account.name,
    role: account.role,
  };
}
