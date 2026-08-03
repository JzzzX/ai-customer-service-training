import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const requireAdmin = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/guards", () => ({
  requireAdmin,
}));

vi.mock("@/components/sign-out-button", () => ({
  SignOutButton: () => <button type="button">退出登录</button>,
}));

import AdminPage from "./page";

describe("AdminPage", () => {
  it("keeps administrators focused on management without a learner-center link", async () => {
    requireAdmin.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.test",
      name: "培训管理员",
      role: "admin",
    });

    render(await AdminPage());

    expect(
      screen.getByRole("heading", { name: "管理员控制台" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "返回训练中心" }),
    ).not.toBeInTheDocument();
  });
});
