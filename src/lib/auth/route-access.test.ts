import { describe, expect, it } from "vitest";

import { decideRouteAccess } from "./route-access";

describe("decideRouteAccess", () => {
  it("allows public pages without a session", () => {
    expect(decideRouteAccess("/", null)).toBe("allow");
    expect(decideRouteAccess("/login", null)).toBe("allow");
    expect(decideRouteAccess("/api/auth/callback/credentials", null)).toBe(
      "allow",
    );
  });

  it("requires a session for learner training pages", () => {
    expect(decideRouteAccess("/practice/quiz", null)).toBe("login");
    expect(
      decideRouteAccess("/practice/quiz", { role: "learner" }),
    ).toBe("allow");
  });

  it("allows only administrators into admin routes", () => {
    expect(decideRouteAccess("/admin", null)).toBe("login");
    expect(decideRouteAccess("/admin/questions", { role: "learner" })).toBe(
      "forbidden",
    );
    expect(decideRouteAccess("/admin/questions", { role: "admin" })).toBe(
      "allow",
    );
  });

  it("redirects administrators away from learner training routes", () => {
    expect(decideRouteAccess("/practice", { role: "admin" })).toBe(
      "redirect_admin",
    );
    expect(
      decideRouteAccess("/practice/profile?tab=quiz", { role: "admin" }),
    ).toBe("redirect_admin");
    expect(decideRouteAccess("/practice", { role: "learner" })).toBe("allow");
  });
});
