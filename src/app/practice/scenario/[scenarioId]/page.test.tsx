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

vi.mock("../actions", () => ({
  startScenarioAction: vi.fn(),
}));

import ScenarioDetailPage from "./page";

describe("ScenarioDetailPage", () => {
  it("shows limited background without exposing hidden facts or scoring", async () => {
    render(
      await ScenarioDetailPage({
        params: Promise.resolve({
          scenarioId: `st_${"1".repeat(24)}`,
        }),
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: "给3个月泰迪推荐主粮",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("根据幼犬情况和预算完成主粮推荐与关联建议。"),
    ).toBeInTheDocument();
    expect(screen.getByText("演示模式")).toBeInTheDocument();
    expect(screen.queryByText("体重2.1kg")).not.toBeInTheDocument();
    expect(screen.queryByText("需求与宠物信息挖掘")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "开始模拟接待" }),
    ).toBeInTheDocument();
  });
});
