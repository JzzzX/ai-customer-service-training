import { describe, expect, it } from "vitest";

import { applyTokenToSession, applyUserToToken } from "./session-claims";

describe("Auth.js session claims", () => {
  it("copies the authenticated user id and role into the JWT", () => {
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

  it("exposes only the id and role claims through the session user", () => {
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
