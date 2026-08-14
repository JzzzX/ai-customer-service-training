import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
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
  signIn: mocks.signIn,
}));

import {
  demoLoginAction,
  feishuLoginAction,
} from "./actions";

describe("login actions", () => {
  beforeEach(() => {
    mocks.redirect.mockReset();
    mocks.signIn.mockReset();
    mocks.signIn.mockResolvedValue(undefined);
    vi.stubEnv("DEMO_MODE", "true");
  });

  it("starts Feishu OAuth login", async () => {
    await feishuLoginAction();

    expect(mocks.signIn).toHaveBeenCalledWith("feishu", {
      redirectTo: "/login/continue",
    });
  });

  it("starts the explicit demo provider in demo mode", async () => {
    await demoLoginAction();

    expect(mocks.signIn).toHaveBeenCalledWith("demo", {
      redirect: false,
    });

    expect(mocks.redirect).toHaveBeenCalledWith(
      "/login/continue",
    );
  });
});
