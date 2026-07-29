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

import ScenarioListPage from "./page";

describe("ScenarioListPage", () => {
  it("shows all eight mock scenarios grouped by business category", async () => {
    render(await ScenarioListPage());

    expect(
      screen.getByRole("heading", { name: "情景实战" }),
    ).toBeInTheDocument();
    expect(screen.getByText("演示模式")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "售前" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "物流" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "破损少货" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "客诉" })).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "开始训练" }),
    ).toHaveLength(8);
    expect(screen.getByText("给3个月泰迪推荐主粮")).toBeInTheDocument();
    expect(screen.getByText("食用后呕吐软便")).toBeInTheDocument();
  });
});
