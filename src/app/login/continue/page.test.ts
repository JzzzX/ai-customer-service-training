import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/auth/guards", () => ({
  requireUser: mocks.requireUser,
}));

import LoginContinuePage from "./page";

describe("LoginContinuePage", () => {
  beforeEach(() => {
    mocks.redirect.mockReset();
    mocks.requireUser.mockReset();
  });

  it("always redirects an authenticated learner to practice", async () => {
    mocks.requireUser.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000001",
      email: "learner@example.test",
      name: "客服学员",
      role: "admin",
    });

    await LoginContinuePage();

    expect(mocks.redirect).toHaveBeenCalledWith("/practice");
  });
});
