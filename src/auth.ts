import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { NextRequest } from "next/server";

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
        const baseUrl = resolveBaseUrl(request);
        const callbackUrl = new URL(request.nextUrl.pathname, baseUrl);
        callbackUrl.search = request.nextUrl.search;
        const loginUrl = new URL("/login", baseUrl);
        loginUrl.searchParams.set("callbackUrl", callbackUrl.toString());
        return Response.redirect(loginUrl);
      }
      if (decision === "forbidden") {
        return Response.redirect(new URL("/forbidden", resolveBaseUrl(request)));
      }
      if (decision === "redirect_admin") {
        return Response.redirect(new URL("/admin", resolveBaseUrl(request)));
      }
      return true;
    },
  },
});

/**
 * 解析请求的真实 base URL。
 *
 * 某些代理平台（如 IGA Pages / DCDN）转发给应用时，
 * `request.nextUrl.host` 会是 Node.js 监听地址（如 0.0.0.0:3000），
 * 而真实 host 在 `x-forwarded-host` 头中。此处优先用转发头构建 URL，
 * 避免登录回跳到不可访问的内部地址。
 */
function resolveBaseUrl(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return request.nextUrl.origin;
}
