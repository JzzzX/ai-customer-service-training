import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { QuizRunner } from "./quiz-runner";
import type { QuizQuestionClient } from "@/lib/quiz/schema";

const source = {
  sourcePath: "培训规则.md",
  kind: "markdown" as const,
  anchor: "heading:基础",
  line: 3,
  path: ["基础"],
};

const questions: QuizQuestionClient[] = [
  {
    id: `qq_${"1".repeat(24)}`,
    type: "single_choice",
    prompt: "第一题的正确选项是？",
    options: ["选项A", "选项B"],
    category: "日常问答",
    difficulty: "easy",
    status: "draft",
  },
  {
    id: `qq_${"2".repeat(24)}`,
    type: "true_false",
    prompt: "第二题判断题",
    options: ["正确", "错误"],
    category: "服务流程与规则",
    difficulty: "easy",
    status: "draft",
  },
];
const initialAttemptId = "00000000-0000-4000-8000-000000000050";
const onAnswer = vi.fn(async (questionId: string, selected: string) => ({
  isCorrect:
    questionId === questions[0]!.id
      ? selected === "选项A"
      : selected === "错误",
  explanation:
    questionId === questions[0]!.id ? "第一题解释" : "第二题解释",
  sourceLabel: `${source.sourcePath} · 第 ${source.line} 行`,
}));

describe("QuizRunner", () => {
  it("shows one question at a time with server-checked feedback and a result", async () => {
    render(
      <QuizRunner
        attemptId={initialAttemptId}
        onAnswer={onAnswer}
        passingScore={80}
        questions={questions}
      />,
    );

    expect(screen.getByText("第 1 / 2 题")).toBeInTheDocument();
    expect(screen.queryByText("第二题判断题")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("选项A"));
    fireEvent.click(screen.getByRole("button", { name: "提交答案" }));
    expect(await screen.findByText("回答正确")).toBeInTheDocument();
    expect(screen.getByText("第一题解释")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "下一题" }));
    fireEvent.click(screen.getByLabelText("正确"));
    fireEvent.click(screen.getByRole("button", { name: "提交答案" }));
    expect(await screen.findByText("回答错误")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看结果" }));

    expect(
      screen.getByRole("heading", { name: "这组需要再练一次" }),
    ).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("restarts with only missed questions", async () => {
    render(
      <QuizRunner
        attemptId={initialAttemptId}
        onAnswer={onAnswer}
        passingScore={80}
        questions={questions}
      />,
    );

    fireEvent.click(screen.getByLabelText("选项B"));
    fireEvent.click(screen.getByRole("button", { name: "提交答案" }));
    await screen.findByText("回答错误");
    fireEvent.click(screen.getByRole("button", { name: "下一题" }));
    fireEvent.click(screen.getByLabelText("错误"));
    fireEvent.click(screen.getByRole("button", { name: "提交答案" }));
    await screen.findByText("回答正确");
    fireEvent.click(screen.getByRole("button", { name: "查看结果" }));
    fireEvent.click(screen.getByRole("button", { name: "重练错题" }));

    expect(screen.getByText("第 1 / 1 题")).toBeInTheDocument();
    expect(screen.getByText("第一题的正确选项是？")).toBeInTheDocument();
  });

  it("submits the completed answer set before showing the result", async () => {
    const attemptId = "00000000-0000-4000-8000-000000000050";
    const onComplete = vi.fn().mockResolvedValue(undefined);
    render(
      <QuizRunner
        attemptId={attemptId}
        onAnswer={onAnswer}
        onComplete={onComplete}
        passingScore={80}
        questions={questions}
      />,
    );

    fireEvent.click(screen.getByLabelText("选项A"));
    fireEvent.click(screen.getByRole("button", { name: "提交答案" }));
    await screen.findByText("回答正确");
    fireEvent.click(screen.getByRole("button", { name: "下一题" }));
    fireEvent.click(screen.getByLabelText("正确"));
    fireEvent.click(screen.getByRole("button", { name: "提交答案" }));
    await screen.findByText("回答错误");
    fireEvent.click(screen.getByRole("button", { name: "查看结果" }));

    await waitFor(() =>
      expect(onComplete).toHaveBeenCalledWith(
        attemptId,
        [
          {
            questionId: questions[0].id,
            selected: "选项A",
          },
          {
            questionId: questions[1].id,
            selected: "正确",
          },
        ],
      ),
    );
    expect(
      screen.getByRole("heading", { name: "这组需要再练一次" }),
    ).toBeInTheDocument();
  });

  it("shuffles single-choice options without receiving standard answers", async () => {
    const fourOptionQuestions: QuizQuestionClient[] = [
      {
        id: `qq_${"3".repeat(24)}`,
        type: "single_choice",
        prompt: "四选项单选题的正确答案是选项一",
        options: ["选项一", "选项二", "选项三", "选项四"],
        category: "日常问答",
        difficulty: "easy",
        status: "draft",
      },
      {
        id: `qq_${"4".repeat(24)}`,
        type: "true_false",
        prompt: "判断题选项顺序稳定",
        options: ["正确", "错误"],
        category: "日常问答",
        difficulty: "easy",
        status: "draft",
      },
    ];
    const checkFourOptions = vi.fn(
      async (questionId: string, selected: string) => ({
        isCorrect:
          questionId === fourOptionQuestions[0]!.id
            ? selected === "选项一"
            : selected === "正确",
        explanation: "服务端返回的解释",
        sourceLabel: "培训规则.md · 第 3 行",
      }),
    );

    render(
      <QuizRunner
        attemptId={initialAttemptId}
        onAnswer={checkFourOptions}
        passingScore={80}
        questions={fourOptionQuestions}
      />,
    );

    expect(
      screen.getByText("四选项单选题的正确答案是选项一"),
    ).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(4);
    const labels = radios.map((radio) => radio.getAttribute("aria-label"));
    expect(labels).toContain("选项一");
    expect(labels).toContain("选项二");
    expect(labels).toContain("选项三");
    expect(labels).toContain("选项四");

    fireEvent.click(screen.getByLabelText("选项一"));
    fireEvent.click(screen.getByRole("button", { name: "提交答案" }));
    expect(await screen.findByText("回答正确")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "下一题" }));
    const tfRadios = screen.getAllByRole("radio");
    expect(tfRadios).toHaveLength(2);
    expect(tfRadios[0]?.getAttribute("aria-label")).toBe("正确");
    expect(tfRadios[1]?.getAttribute("aria-label")).toBe("错误");
  });
});
