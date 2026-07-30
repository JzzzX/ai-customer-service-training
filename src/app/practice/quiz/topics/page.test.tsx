import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/guards", () => ({
  requireUser: vi.fn().mockResolvedValue({
    id: "learner-1",
    name: "测试学员",
    email: "learner@example.test",
    role: "learner",
  }),
}));

import QuizTopicsPage from "./page";

describe("QuizTopicsPage", () => {
  it("renders 5 topic cards with links to /practice/quiz?topic=", async () => {
    render(await QuizTopicsPage());

    expect(
      screen.getByRole("heading", { name: "选择专题" }),
    ).toBeInTheDocument();

    const topicLabels = [
      "产品属性及卖点",
      "宠物生理和喂养",
      "活动促销",
      "服务流程与规则",
      "日常问答",
    ];
    for (const label of topicLabels) {
      expect(
        screen.getByRole("heading", { name: label }),
      ).toBeInTheDocument();
    }

    const topicLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.includes("/practice/quiz?topic="));
    expect(topicLinks).toHaveLength(5);
  });
});
