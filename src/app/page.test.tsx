import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "./page";

describe("HomePage", () => {
  it("presents the two core training paths without extra gamification", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", { name: "AI 客服训练", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "知识小测" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "情景实战" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "开始知识小测" }),
    ).toHaveAttribute("href", "/practice/quiz");
    expect(
      screen.getByRole("link", { name: "进入情景实战" }),
    ).toHaveAttribute("href", "/practice/scenario");
    expect(screen.queryByText("排行榜")).not.toBeInTheDocument();
  });
});
