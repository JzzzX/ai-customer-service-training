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

  it.each([
    ["admin", "/admin"],
    ["learner", "/practice"],
  ] as const)("redirects %s from the persisted session to %s", async (role, path) => {
    mocks.requireUser.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000001",
      email: `${role}@example.test`,
      name: role,
      role,
    });

    await LoginContinuePage();

    expect(mocks.redirect).toHaveBeenCalledWith(path);
  });
});
