import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LoginPage from "./page";

vi.mock("./actions", () => ({
  demoLoginAction: async () => {},
  feishuLoginAction: async () => {},
}));

describe("LoginPage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("offers Feishu-only sign-in for the persistent learner app", () => {
    render(<LoginPage />);

    expect(
      screen.getByRole("heading", {
        name: "学员登录",
        level: 1,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "使用飞书登录",
      }),
    ).toBeInTheDocument();

    expect(screen.queryByLabelText("邮箱")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("密码")).not.toBeInTheDocument();

    expect(
      screen.getByText(
        "仅限已分配并通过飞书验证的培训账号登录",
      ),
    ).toBeInTheDocument();
  });

  it("shows the direct demo entry only when demo mode is enabled", () => {
    vi.stubEnv("DEMO_MODE", "true");

    render(<LoginPage />);

    expect(
      screen.getByRole("button", {
        name: "直接进入演示",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText("演示环境，不保存数据"),
    ).toBeInTheDocument();
  });
});
