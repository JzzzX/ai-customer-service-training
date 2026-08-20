import type { UserRole } from "@/db/schema";

export type RouteAccessDecision = "allow" | "login" | "forbidden";

export function decideRouteAccess(
  pathname: string,
  user: object | null | undefined,
): RouteAccessDecision {
  if (isPublicPath(pathname)) {
    return "allow";
  }

  if (!user) {
    return "login";
  }

  if (isPathWithin(pathname, "/admin")) {
    return readRole(user) === "admin" ? "allow" : "forbidden";
  }

  if (isPathWithin(pathname, "/practice")) {
    return readRole(user) === "learner" ? "allow" : "forbidden";
  }

  return "allow";
}

function readRole(user: object): UserRole | null {
  if (!("role" in user)) {
    return null;
  }
  return user.role === "admin" || user.role === "learner" ? user.role : null;
}

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/forbidden" ||
    pathname === "/api/health" ||
    pathname === "/api/ready" ||
    isPathWithin(pathname, "/api/auth")
  );
}

function isPathWithin(pathname: string, root: string): boolean {
  return pathname === root || pathname.startsWith(`${root}/`);
}
