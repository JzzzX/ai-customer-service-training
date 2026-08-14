export type RouteAccessDecision = "allow" | "login";

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

  return "allow";
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
