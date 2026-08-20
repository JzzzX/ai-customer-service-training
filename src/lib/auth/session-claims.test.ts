import { describe, expect, it } from "vitest";

import {
  applyTokenToSession,
  applyUserToToken,
  resolveAuthenticatedUserId,
} from "./session-claims";

describe("Auth.js session claims", () => {
  it("uses the persisted user id for Feishu OAuth", () => {
    expect(
      resolveAuthenticatedUserId(
        "authjs-temporary-user-id",
        {
          provider: "feishu",
          providerAccountId: "database-user-id",
        },
      ),
    ).toBe("database-user-id");
  });

  it("keeps the Auth.js user id for non-Feishu providers", () => {
    expect(
      resolveAuthenticatedUserId(
        "original-user-id",
        {
          provider: "demo",
          providerAccountId: "other-account-id",
        },
      ),
    ).toBe("original-user-id");
  });

  it("copies only the authenticated user id into the JWT", () => {
    expect(
      applyUserToToken(
        { name: "培训管理员" },
        {
          id: "admin-id",
          name: "培训管理员",
          email: "admin@example.test",
          role: "admin",
        },
      ),
    ).toMatchObject({
      id: "admin-id",
      role: "admin",
      name: "培训管理员",
    });
  });

  it("exposes only the id claim through the session user", () => {
    expect(
      applyTokenToSession(
        {
          expires: "2099-01-01T00:00:00.000Z",
          user: {
            name: "客服学员",
            email: "learner@example.test",
          },
        },
        {
          id: "learner-id",
          role: "learner",
        },
      ),
    ).toEqual({
      expires: "2099-01-01T00:00:00.000Z",
      user: {
        id: "learner-id",
        role: "learner",
        name: "客服学员",
        email: "learner@example.test",
      },
    });
  });
});
