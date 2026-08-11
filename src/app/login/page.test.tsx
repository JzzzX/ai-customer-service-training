import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LoginPage from "./page";

vi.mock("./actions", () => ({
  demoLoginAction: async () => {},
  loginAction: async () => ({}),
}));

describe("LoginPage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("offers a learner-only sign-in flow", () => {
    render(<LoginPage />);

    expect(
      screen.getByRole("heading", { name: "学员登录", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "学员" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "管理员" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("邮箱")).toBeInTheDocument();
    expect(screen.getByLabelText("密码")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "登录并继续" }),
    ).toBeInTheDocument();
    expect(screen.getByText("仅限已分配的培训账号登录")).toBeInTheDocument();
    expect(screen.queryByText("注册")).not.toBeInTheDocument();
  });

  it("shows the direct demo entry only when demo mode is enabled", () => {
    vi.stubEnv("DEMO_MODE", "true");

    render(<LoginPage />);

    expect(
      screen.getByRole("button", { name: "直接进入演示" }),
    ).toBeInTheDocument();
    expect(screen.getByText("演示环境，不保存数据")).toBeInTheDocument();
  });

});
