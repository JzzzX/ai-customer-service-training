import { describe, expect, it } from "vitest";

import { applyTokenToSession, applyUserToToken } from "./session-claims";

describe("Auth.js session claims", () => {
  it("copies only the authenticated user id into the JWT", () => {
    expect(
      applyUserToToken(
        { name: "培训管理员" },
        {
          id: "admin-id",
          name: "培训管理员",
          email: "admin@example.test",
        },
      ),
    ).toMatchObject({
      id: "admin-id",
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
        },
      ),
    ).toEqual({
      expires: "2099-01-01T00:00:00.000Z",
      user: {
        id: "learner-id",
        name: "客服学员",
        email: "learner@example.test",
      },
    });
  });
});
