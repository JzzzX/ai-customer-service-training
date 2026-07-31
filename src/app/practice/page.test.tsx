import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/guards", () => ({
  requireUser: vi.fn().mockResolvedValue({
    id: "00000000-0000-4000-8000-000000000002",
    name: "测试学员",
    email: "learner@example.test",
    role: "learner",
  }),
}));

vi.mock("@/components/sign-out-button", () => ({
  SignOutButton: () => <button type="button">退出登录</button>,
}));

import PracticePage from "./page";

describe("PracticePage", () => {
  it("offers both quiz and scenario training without extra navigation", async () => {
    render(await PracticePage());

    expect(
      screen.getByRole("link", { name: "选择专题" }),
    ).toHaveAttribute("href", "/practice/quiz/topics");
    expect(
      screen.getByRole("link", { name: "开始实战" }),
    ).toHaveAttribute("href", "/practice/scenario");
    expect(
      screen.getByRole("link", { name: "查看任务" }),
    ).toHaveAttribute("href", "/practice/assignments");
    expect(
      screen.getByRole("link", { name: "查看练习记录" }),
    ).toHaveAttribute("href", "/practice/history");
  });
});
