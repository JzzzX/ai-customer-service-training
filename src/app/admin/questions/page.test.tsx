import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/guards", () => ({
  requireAdmin: vi.fn().mockResolvedValue({
    id: "admin-1",
    name: "培训管理员",
    email: "admin@example.test",
    role: "admin",
  }),
}));

vi.mock("@/lib/quiz/review-service", () => ({
  loadQuizReview: vi.fn().mockResolvedValue({
    schemaVersion: 1,
    sourceQuizHash: "a".repeat(64),
    knowledgePackHash: "b".repeat(64),
    title: "客服新人知识基础小测",
    passingScore: 80,
    questions: [
      {
        decision: "pending",
        question: {
          id: `qq_${"1".repeat(24)}`,
          knowledgeUnitId: `ku_${"1".repeat(24)}`,
          type: "single_choice",
          prompt: "待审核题目",
          options: ["标准答案", "干扰答案"],
          correctAnswers: ["标准答案"],
          explanation: "答案解释",
          category: "日常问答",
          difficulty: "easy",
          status: "draft",
          sources: [
            {
              sourcePath: "问答.md",
              kind: "markdown",
              anchor: "heading:1",
              line: 2,
              path: ["问答"],
            },
          ],
        },
      },
      {
        decision: "approved",
        reviewerId: "admin-1",
        question: {
          id: `qq_${"2".repeat(24)}`,
          knowledgeUnitId: `ku_${"2".repeat(24)}`,
          type: "true_false",
          prompt: "已审核题目",
          options: ["正确", "错误"],
          correctAnswers: ["正确"],
          explanation: "答案解释",
          category: "服务流程与规则",
          difficulty: "easy",
          status: "draft",
          sources: [
            {
              sourcePath: "服务.md",
              kind: "markdown",
              anchor: "heading:2",
              line: 4,
              path: ["服务"],
            },
          ],
        },
      },
    ],
  }),
  loadPublishedQuiz: vi.fn().mockResolvedValue(null),
}));

import AdminQuestionsPage from "./page";

describe("AdminQuestionsPage", () => {
  it("shows one editable question with review progress and source", async () => {
    render(
      await AdminQuestionsPage({
        searchParams: Promise.resolve({ index: "0" }),
      }),
    );

    expect(
      screen.getByRole("heading", { name: "题目检查" }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 / 2 已复核（可选）")).toBeInTheDocument();
    expect(screen.getByLabelText("题干")).toHaveValue("待审核题目");
    expect(screen.getByLabelText("正确答案")).toHaveValue("标准答案");
    expect(
      screen.getByText(
        (_, element) =>
          element?.textContent === "知识来源：问答.md · 第 2 行",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "审核通过并下一题" }),
    ).toBeInTheDocument();
    const publishButton = screen.getByRole("button", {
      name: "自动发布正式题组",
    });
    expect(publishButton).toBeInTheDocument();
    expect(publishButton).not.toBeDisabled();
  });
});
