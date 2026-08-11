import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  redirect: vi.fn(),
  signIn: vi.fn(),
}));

vi.mock("next-auth", () => ({
  AuthError: class AuthError extends Error {},
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
  signIn: mocks.signIn,
}));

import { demoLoginAction, loginAction } from "./actions";

describe("loginAction", () => {
  beforeEach(() => {
    mocks.redirect.mockReset();
    mocks.signIn.mockReset();
    mocks.auth.mockReset();
    mocks.auth.mockResolvedValue(null);
    mocks.signIn.mockResolvedValue(undefined);
    vi.stubEnv("DEMO_MODE", "true");
  });

  it("resolves the authenticated role on a follow-up request", async () => {
    const formData = new FormData();
    formData.set("email", "admin@example.test");
    formData.set("password", "secret");

    await loginAction({}, formData);

    expect(mocks.signIn).toHaveBeenCalledWith("credentials", {
      email: "admin@example.test",
      password: "secret",
      redirect: false,
    });
    expect(mocks.redirect).toHaveBeenCalledWith("/login/continue");
  });

  it("starts the explicit demo provider and redirects to the learner app", async () => {
    await demoLoginAction();

    expect(mocks.signIn).toHaveBeenCalledWith("demo", { redirect: false });
    expect(mocks.redirect).toHaveBeenCalledWith("/login/continue");
  });
});
