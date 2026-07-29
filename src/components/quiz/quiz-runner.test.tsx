import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { QuizRunner } from "./quiz-runner";
import type { QuizQuestionDraft } from "@/lib/quiz/schema";

const source = {
  sourcePath: "培训规则.md",
  kind: "markdown" as const,
  anchor: "heading:基础",
  line: 3,
  path: ["基础"],
};

const questions: QuizQuestionDraft[] = [
  {
    id: `qq_${"1".repeat(24)}`,
    knowledgeUnitId: `ku_${"1".repeat(24)}`,
    type: "single_choice",
    prompt: "第一题的正确选项是？",
    options: ["选项A", "选项B"],
    correctAnswers: ["选项A"],
    explanation: "第一题解释",
    category: "日常问答",
    difficulty: "easy",
    status: "draft",
    sources: [source],
  },
  {
    id: `qq_${"2".repeat(24)}`,
    knowledgeUnitId: `ku_${"2".repeat(24)}`,
    type: "true_false",
    prompt: "第二题判断题",
    options: ["正确", "错误"],
    correctAnswers: ["错误"],
    explanation: "第二题解释",
    category: "服务流程与规则",
    difficulty: "easy",
    status: "draft",
    sources: [source],
  },
];

describe("QuizRunner", () => {
  it("shows one question at a time with immediate feedback and a result", () => {
    render(<QuizRunner passingScore={80} questions={questions} />);

    expect(screen.getByText("第 1 / 2 题")).toBeInTheDocument();
    expect(screen.queryByText("第二题判断题")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("选项A"));
    fireEvent.click(screen.getByRole("button", { name: "提交答案" }));
    expect(screen.getByText("回答正确")).toBeInTheDocument();
    expect(screen.getByText("第一题解释")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "下一题" }));
    fireEvent.click(screen.getByLabelText("正确"));
    fireEvent.click(screen.getByRole("button", { name: "提交答案" }));
    expect(screen.getByText("回答错误")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看结果" }));

    expect(
      screen.getByRole("heading", { name: "这组需要再练一次" }),
    ).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("restarts with only missed questions", () => {
    render(<QuizRunner passingScore={80} questions={questions} />);

    fireEvent.click(screen.getByLabelText("选项B"));
    fireEvent.click(screen.getByRole("button", { name: "提交答案" }));
    fireEvent.click(screen.getByRole("button", { name: "下一题" }));
    fireEvent.click(screen.getByLabelText("错误"));
    fireEvent.click(screen.getByRole("button", { name: "提交答案" }));
    fireEvent.click(screen.getByRole("button", { name: "查看结果" }));
    fireEvent.click(screen.getByRole("button", { name: "重练错题" }));

    expect(screen.getByText("第 1 / 1 题")).toBeInTheDocument();
    expect(screen.getByText("第一题的正确选项是？")).toBeInTheDocument();
  });
});
