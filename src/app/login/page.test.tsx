import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LoginPage from "./page";

vi.mock("./actions", () => ({
  loginAction: async () => ({}),
}));

describe("LoginPage", () => {
  it("offers a focused sign-in flow with role tabs", () => {
    render(<LoginPage />);

    expect(
      screen.getByRole("heading", { name: "学员登录", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "学员" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "管理员" })).toBeInTheDocument();
    expect(screen.getByLabelText("邮箱")).toBeInTheDocument();
    expect(screen.getByLabelText("密码")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "登录并继续" }),
    ).toBeInTheDocument();
    expect(screen.getByText("仅限已分配的培训账号登录")).toBeInTheDocument();
    expect(screen.queryByText("注册")).not.toBeInTheDocument();
  });

  it("switches heading copy when admin tab is selected", () => {
    render(<LoginPage />);

    expect(
      screen.getByRole("heading", { name: "学员登录" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "管理员" }));

    expect(
      screen.getByRole("heading", { name: "管理员登录" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("登录后进入培训管理控制台。"),
    ).toBeInTheDocument();
  });
});
