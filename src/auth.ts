import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { NextRequest } from "next/server";

import { FeishuProvider } from "@/lib/auth/feishu-provider";
import { decideRouteAccess } from "@/lib/auth/route-access";
import {
  applyTokenToSession,
  applyUserToToken,
} from "@/lib/auth/session-claims";
import {
  DEMO_USER_EMAIL,
  DEMO_USER_ID,
  DEMO_USER_NAME,
} from "@/lib/runtime/demo-identity";
import { isDemoMode } from "@/lib/runtime/mode";

const providers = [
  FeishuProvider(),

  ...(isDemoMode()
    ? [
        Credentials({
          id: "demo",
          name: "演示登录",
          credentials: {},
          authorize: () => ({
            id: DEMO_USER_ID,
            email: DEMO_USER_EMAIL,
            name: DEMO_USER_NAME,
          }),
        }),
      ]
    : []),
];

export const { auth, handlers, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers,

  callbacks: {
    jwt({ token, user }) {
      if (!user?.id) {
        return token;
      }

      return applyUserToToken(token, {
        id: user.id,
        email: user.email ?? "",
        name: user.name ?? "",
      });
    },

    session({ session, token }) {
      if (typeof token.id !== "string") {
        return session;
      }

      return applyTokenToSession(session, {
        id: token.id,
      });
    },

    authorized({ auth: session, request }) {
      const decision = decideRouteAccess(
        request.nextUrl.pathname,
        session?.user,
      );

      if (decision === "login") {
        const baseUrl = resolveBaseUrl(request);
        const callbackUrl = new URL(request.nextUrl.pathname, baseUrl);
        callbackUrl.search = request.nextUrl.search;

        const loginUrl = new URL("/login", baseUrl);
        loginUrl.searchParams.set("callbackUrl", callbackUrl.toString());

        return Response.redirect(loginUrl);
      }

      return true;
    },
  },
});

function resolveBaseUrl(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto =
    request.headers.get("x-forwarded-proto") ?? "https";

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return request.nextUrl.origin;
}
