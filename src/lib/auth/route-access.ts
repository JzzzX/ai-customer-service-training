import type { UserRole } from "./credentials";

export type RouteAccessDecision =
  | "allow"
  | "login"
  | "forbidden"
  | "redirect_admin";

interface RouteUser {
  role: UserRole;
}

export function decideRouteAccess(
  pathname: string,
  user: RouteUser | null | undefined,
): RouteAccessDecision {
  if (isPublicPath(pathname)) {
    return "allow";
  }

  if (!user) {
    return "login";
  }

  if (isPathWithin(pathname, "/practice") && user.role === "admin") {
    return "redirect_admin";
  }

  if (isPathWithin(pathname, "/admin") && user.role !== "admin") {
    return "forbidden";
  }

  return "allow";
}

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/forbidden" ||
    isPathWithin(pathname, "/api/auth")
  );
}

function isPathWithin(pathname: string, root: string): boolean {
  return pathname === root || pathname.startsWith(`${root}/`);
}
