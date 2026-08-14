export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

interface SessionShape {
  expires: string;
  user: object;
}

interface SessionClaims {
  id: string;
}

interface AuthAccountIdentity {
  provider?: string;
  providerAccountId?: string;
}

export function resolveAuthenticatedUserId(
  userId: string,
  account?: AuthAccountIdentity | null,
): string {
  if (account?.provider === "feishu") {
    const providerAccountId = account.providerAccountId?.trim();

    if (providerAccountId) {
      return providerAccountId;
    }
  }

  return userId;
}

export function applyUserToToken<T extends Record<string, unknown>>(
  token: T,
  user: SessionUser,
): T & SessionClaims {
  return {
    ...token,
    id: user.id,
  };
}

export function applyTokenToSession<T extends SessionShape>(
  session: T,
  token: SessionClaims,
): T & { user: T["user"] & SessionClaims } {
  return {
    ...session,
    user: {
      ...session.user,
      id: token.id,
    },
  };
}
