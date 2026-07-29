import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { QuizPublishedPack } from "@/lib/quiz/schema";

const mocks = vi.hoisted(() => ({
  loadPublishedQuiz: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireUser: vi.fn().mockResolvedValue({
    id: "learner-1",
    name: "测试学员",
    email: "learner@example.test",
    role: "learner",
  }),
}));

vi.mock("@/lib/quiz/review-service", () => ({
  loadPublishedQuiz: mocks.loadPublishedQuiz,
}));

vi.mock("@/components/quiz/quiz-runner", () => ({
  QuizRunner: ({
    onComplete,
    passingScore,
    questions,
  }: {
    onComplete?: () => Promise<void>;
    passingScore: number;
    questions: QuizPublishedPack["questions"];
  }) => (
    <div data-testid="quiz-runner">
      {questions.length}|{passingScore}|{questions[0]?.status}|
      {onComplete ? "recorded" : "not-recorded"}
    </div>
  ),
}));

import PracticeQuizPage from "./page";

function publishedQuiz(): QuizPublishedPack {
  return {
    schemaVersion: 1,
    quizHash: "a".repeat(64),
    sourceQuizHash: "b".repeat(64),
    knowledgePackHash: "c".repeat(64),
    title: "客服新人知识基础小测",
    passingScore: 80,
    status: "published",
    questions: Array.from({ length: 12 }, (_, index) => {
      const idDigit = index.toString(16);
      const type = index < 6 ? "single_choice" : "true_false";
      return {
        id: `qq_${idDigit.repeat(24)}`,
        knowledgeUnitId: `ku_${idDigit.repeat(24)}`,
        type,
        prompt: `正式题目 ${index + 1}`,
        options:
          type === "true_false" ? ["正确", "错误"] : ["答案", "干扰项"],
        correctAnswers: [type === "true_false" ? "正确" : "答案"],
        explanation: "答案解释",
        category: "日常问答",
        difficulty: "easy",
        status: "published",
        sources: [
          {
            sourcePath: "问答.md",
            kind: "markdown",
            anchor: `heading:${index + 1}`,
            path: ["问答"],
          },
        ],
      };
    }),
  };
}

describe("PracticeQuizPage", () => {
  beforeEach(() => {
    mocks.loadPublishedQuiz.mockReset();
  });

  it("uses a 10-question group from the published quiz", async () => {
    mocks.loadPublishedQuiz.mockResolvedValue(publishedQuiz());

    render(await PracticeQuizPage());

    expect(screen.getByText("正式题组")).toBeInTheDocument();
    expect(screen.getByTestId("quiz-runner")).toHaveTextContent(
      "10|80|published|recorded",
    );
  });

  it("keeps the demo quiz available before a quiz is published", async () => {
    mocks.loadPublishedQuiz.mockResolvedValue(null);

    render(await PracticeQuizPage());

    expect(screen.getByText("交互演示题")).toBeInTheDocument();
    expect(screen.getByTestId("quiz-runner")).toHaveTextContent(
      "5|80|draft|not-recorded",
    );
  });
});
