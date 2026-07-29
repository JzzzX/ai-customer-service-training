import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/guards", () => ({
  requireUser: vi.fn().mockResolvedValue({
    id: "learner-1",
    name: "测试学员",
    email: "learner@example.com",
    role: "learner",
  }),
}));

import PracticeQuizPage from "./page";

describe("PracticeQuizPage", () => {
  it("clearly labels the temporary demo question set", async () => {
    render(await PracticeQuizPage());

    expect(
      screen.getByRole("heading", { name: "知识小测" }),
    ).toBeInTheDocument();
    expect(screen.getByText("交互演示题")).toBeInTheDocument();
    expect(screen.getByText(/正式40题仍在管理员审核/)).toBeInTheDocument();
  });
});
