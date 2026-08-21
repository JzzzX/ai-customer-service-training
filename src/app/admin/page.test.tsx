import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const requireAdmin = vi.hoisted(() => vi.fn().mockResolvedValue({ id: "admin-1", name: "管理员", role: "admin" }));
vi.mock("@/lib/auth/guards", () => ({ requireAdmin }));

import AdminPage from "./page";

describe("AdminPage", () => {
  it("uses the live guard and links to question management without practice actions", async () => {
    render(await AdminPage());
    expect(requireAdmin).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "进入题库管理" })).toHaveAttribute("href", "/admin/questions");
    expect(screen.getByRole("link", { name: "查看学员报告" })).toHaveAttribute("href", "/admin/reports");
    expect(screen.queryByText("开始练习")).not.toBeInTheDocument();
  });
});
