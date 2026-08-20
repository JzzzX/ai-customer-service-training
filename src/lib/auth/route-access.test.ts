import { describe, expect, it } from "vitest";

import { decideRouteAccess } from "./route-access";

describe("decideRouteAccess", () => {
  it("allows public pages without a session", () => {
    expect(decideRouteAccess("/", null)).toBe("allow");
    expect(decideRouteAccess("/login", null)).toBe("allow");
    expect(decideRouteAccess("/api/auth/callback/feishu", null)).toBe(
      "allow",
    );
    expect(decideRouteAccess("/api/health", null)).toBe("allow");
    expect(decideRouteAccess("/api/ready", null)).toBe("allow");
  });

  it("requires a session for learner training pages", () => {
    expect(decideRouteAccess("/practice/quiz", null)).toBe("login");
    expect(
      decideRouteAccess("/practice/quiz", { role: "learner" }),
    ).toBe("allow");
  });

  it("allows only admins into admin paths", () => {
    expect(decideRouteAccess("/admin", null)).toBe("login");
    expect(decideRouteAccess("/admin/questions", { role: "learner" })).toBe(
      "forbidden",
    );
    expect(decideRouteAccess("/admin/questions", { role: "admin" })).toBe("allow");
  });

  it("allows only learners into training routes", () => {
    expect(decideRouteAccess("/practice", { role: "admin" })).toBe(
      "forbidden",
    );
    expect(
      decideRouteAccess("/practice/profile?tab=quiz", { role: "admin" }),
    ).toBe("forbidden");
    expect(decideRouteAccess("/practice", { role: "learner" })).toBe("allow");
  });

  it("denies protected role paths when an old token has no role claim", () => {
    expect(decideRouteAccess("/practice", { id: "legacy-session" })).toBe(
      "forbidden",
    );
    expect(decideRouteAccess("/admin", { id: "legacy-session" })).toBe(
      "forbidden",
    );
  });
});
