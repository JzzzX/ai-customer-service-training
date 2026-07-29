import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LoginPage from "./page";

vi.mock("./actions", () => ({
  loginAction: async () => ({}),
}));

describe("LoginPage", () => {
  it("offers a focused sign-in flow without registration", () => {
    render(<LoginPage />);

    expect(
      screen.getByRole("heading", { name: "欢迎回来", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("邮箱")).toBeInTheDocument();
    expect(screen.getByLabelText("密码")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "登录并继续" }),
    ).toBeInTheDocument();
    expect(screen.getByText("仅限已分配的培训账号登录")).toBeInTheDocument();
    expect(screen.queryByText("注册")).not.toBeInTheDocument();
  });
});
