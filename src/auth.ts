import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authenticateCredentials } from "@/lib/auth/credentials";
import { decideRouteAccess } from "@/lib/auth/route-access";
import {
  applyTokenToSession,
  applyUserToToken,
} from "@/lib/auth/session-claims";
import { findUserByEmail } from "@/lib/auth/user-repository";

export const { auth, handlers, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },
      authorize: (credentials) =>
        authenticateCredentials(credentials, findUserByEmail),
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (!user?.id) {
        return token;
      }

      return applyUserToToken(token, {
        id: user.id,
        email: user.email ?? "",
        name: user.name ?? "",
        role: user.role,
      });
    },
    session({ session, token }) {
      if (
        typeof token.id !== "string" ||
        (token.role !== "admin" && token.role !== "learner")
      ) {
        return session;
      }

      return applyTokenToSession(session, {
        id: token.id,
        role: token.role,
      });
    },
    authorized({ auth: session, request }) {
      const decision = decideRouteAccess(
        request.nextUrl.pathname,
        session?.user,
      );

      if (decision === "login") {
        return false;
      }
      if (decision === "forbidden") {
        return Response.redirect(new URL("/forbidden", request.nextUrl));
      }
      return true;
    },
  },
});
