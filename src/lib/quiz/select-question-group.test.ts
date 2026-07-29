import { describe, expect, it } from "vitest";

import type { QuizQuestionPublished } from "./schema";
import { selectQuestionGroup } from "./select-question-group";

function question(
  idDigit: string,
  type: QuizQuestionPublished["type"],
): QuizQuestionPublished {
  return {
    id: `qq_${idDigit.repeat(24)}`,
    knowledgeUnitId: `ku_${idDigit.repeat(24)}`,
    type,
    prompt: `题目 ${idDigit}`,
    options: type === "true_false" ? ["正确", "错误"] : ["答案", "干扰项"],
    correctAnswers: [type === "true_false" ? "正确" : "答案"],
    explanation: "答案解释",
    category: "日常问答",
    difficulty: "easy",
    status: "published",
    sources: [
      {
        sourcePath: "问答.md",
        kind: "markdown",
        anchor: `heading:${idDigit}`,
        path: ["问答"],
      },
    ],
  };
}

describe("selectQuestionGroup", () => {
  it("selects at most 10 questions and balances choice and true-false", () => {
    const questions = [
      ...["1", "2", "3", "4", "5", "6"].map((id) =>
        question(id, "single_choice"),
      ),
      ...["a", "b", "c", "d", "e", "f"].map((id) =>
        question(id, "true_false"),
      ),
    ];

    const selected = selectQuestionGroup(questions);

    expect(selected).toHaveLength(10);
    expect(
      selected.filter((item) => item.type === "single_choice"),
    ).toHaveLength(5);
    expect(
      selected.filter((item) => item.type === "true_false"),
    ).toHaveLength(5);
    expect(selected.map((item) => item.id)).toEqual([
      questions[0].id,
      questions[6].id,
      questions[1].id,
      questions[7].id,
      questions[2].id,
      questions[8].id,
      questions[3].id,
      questions[9].id,
      questions[4].id,
      questions[10].id,
    ]);
  });

  it("uses every available question when fewer than the group size exist", () => {
    const questions = [
      question("1", "single_choice"),
      question("a", "true_false"),
      question("2", "single_choice"),
    ];

    expect(selectQuestionGroup(questions)).toEqual([
      questions[0],
      questions[1],
      questions[2],
    ]);
  });
});
