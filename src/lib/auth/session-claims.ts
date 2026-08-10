import type { SessionUser } from "./credentials";

interface SessionShape {
  expires: string;
  user: object;
}

interface SessionClaims {
  id: string;
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
