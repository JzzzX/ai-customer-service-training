import { describe, expect, it } from "vitest";

import type { QuizQuestion, QuizQuestionPublished } from "./schema";
import {
  selectQuestionGroup,
  selectQuestionGroupByTopic,
} from "./select-question-group";

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

function draftQuestion(
  idDigit: string,
  category: string,
  difficulty: QuizQuestion["difficulty"],
  type: QuizQuestion["type"] = "single_choice",
): QuizQuestion {
  return {
    id: `qq_${idDigit.padStart(24, "0")}`,
    knowledgeUnitId: `ku_${idDigit.padStart(24, "0")}`,
    type,
    prompt: `题目 ${idDigit}`,
    options: type === "true_false" ? ["正确", "错误"] : ["答案", "干扰项"],
    correctAnswers: [type === "true_false" ? "正确" : "答案"],
    explanation: "答案解释",
    category,
    difficulty,
    status: "draft",
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

describe("selectQuestionGroupByTopic", () => {
  it("filters by category and returns up to 10 questions", () => {
    const questions = [
      ...Array.from({ length: 10 }, (_, index) =>
        draftQuestion(`${index + 1}`, "产品属性及卖点", "easy"),
      ),
      ...Array.from({ length: 10 }, (_, index) =>
        draftQuestion(`${index + 11}`, "活动促销", "easy"),
      ),
    ];

    const selected = selectQuestionGroupByTopic(questions, "产品属性及卖点");

    expect(selected).toHaveLength(10);
    expect(
      selected.every((item) => item.category === "产品属性及卖点"),
    ).toBe(true);
  });

  it("respects difficulty quotas when enough questions exist", () => {
    const questions = [
      ...Array.from({ length: 5 }, (_, index) =>
        draftQuestion(`e${index + 1}`, "产品属性及卖点", "easy"),
      ),
      ...Array.from({ length: 5 }, (_, index) =>
        draftQuestion(`m${index + 1}`, "产品属性及卖点", "medium"),
      ),
      ...Array.from({ length: 5 }, (_, index) =>
        draftQuestion(`h${index + 1}`, "产品属性及卖点", "hard"),
      ),
    ];

    const selected = selectQuestionGroupByTopic(questions, "产品属性及卖点");

    expect(selected).toHaveLength(10);
    expect(
      selected.filter((item) => item.difficulty === "easy"),
    ).toHaveLength(4);
    expect(
      selected.filter((item) => item.difficulty === "medium"),
    ).toHaveLength(4);
    expect(
      selected.filter((item) => item.difficulty === "hard"),
    ).toHaveLength(2);
  });

  it("returns empty array when topic has no questions", () => {
    const questions = [
      draftQuestion("1", "产品属性及卖点", "easy"),
      draftQuestion("2", "活动促销", "easy"),
    ];

    expect(selectQuestionGroupByTopic(questions, "不存在的专题")).toEqual([]);
  });

  it("fills from leftovers when a difficulty bucket is insufficient", () => {
    const questions = [
      ...Array.from({ length: 8 }, (_, index) =>
        draftQuestion(`e${index + 1}`, "产品属性及卖点", "easy"),
      ),
      draftQuestion("m1", "产品属性及卖点", "medium"),
      draftQuestion("h1", "产品属性及卖点", "hard"),
    ];

    const selected = selectQuestionGroupByTopic(questions, "产品属性及卖点");

    expect(selected).toHaveLength(10);
    expect(
      selected.filter((item) => item.difficulty === "easy"),
    ).toHaveLength(8);
    expect(
      selected.filter((item) => item.difficulty === "medium"),
    ).toHaveLength(1);
    expect(
      selected.filter((item) => item.difficulty === "hard"),
    ).toHaveLength(1);
  });

  it("returns 5 single-choice + 5 true-false when both types have enough questions", () => {
    const questions = [
      ...Array.from({ length: 5 }, (_, index) =>
        draftQuestion(`se${index + 1}`, "产品属性及卖点", "easy", "single_choice"),
      ),
      ...Array.from({ length: 5 }, (_, index) =>
        draftQuestion(`sm${index + 1}`, "产品属性及卖点", "medium", "single_choice"),
      ),
      ...Array.from({ length: 5 }, (_, index) =>
        draftQuestion(`sh${index + 1}`, "产品属性及卖点", "hard", "single_choice"),
      ),
      ...Array.from({ length: 5 }, (_, index) =>
        draftQuestion(`te${index + 1}`, "产品属性及卖点", "easy", "true_false"),
      ),
      ...Array.from({ length: 5 }, (_, index) =>
        draftQuestion(`tm${index + 1}`, "产品属性及卖点", "medium", "true_false"),
      ),
      ...Array.from({ length: 5 }, (_, index) =>
        draftQuestion(`th${index + 1}`, "产品属性及卖点", "hard", "true_false"),
      ),
    ];

    const selected = selectQuestionGroupByTopic(questions, "产品属性及卖点");

    expect(selected).toHaveLength(10);
    expect(
      selected.filter((item) => item.type === "single_choice"),
    ).toHaveLength(5);
    expect(
      selected.filter((item) => item.type === "true_false"),
    ).toHaveLength(5);
    expect(
      selected.filter((item) => item.difficulty === "easy"),
    ).toHaveLength(4);
    expect(
      selected.filter((item) => item.difficulty === "medium"),
    ).toHaveLength(4);
    expect(
      selected.filter((item) => item.difficulty === "hard"),
    ).toHaveLength(2);
  });

  it("falls back to difficulty quotas when true-false questions are fewer than 5", () => {
    const questions = [
      ...Array.from({ length: 5 }, (_, index) =>
        draftQuestion(`se${index + 1}`, "产品属性及卖点", "easy", "single_choice"),
      ),
      ...Array.from({ length: 5 }, (_, index) =>
        draftQuestion(`sm${index + 1}`, "产品属性及卖点", "medium", "single_choice"),
      ),
      ...Array.from({ length: 5 }, (_, index) =>
        draftQuestion(`sh${index + 1}`, "产品属性及卖点", "hard", "single_choice"),
      ),
      ...Array.from({ length: 3 }, (_, index) =>
        draftQuestion(`te${index + 1}`, "产品属性及卖点", "easy", "true_false"),
      ),
    ];

    const selected = selectQuestionGroupByTopic(questions, "产品属性及卖点");

    expect(selected).toHaveLength(10);
    expect(
      selected.filter((item) => item.difficulty === "easy"),
    ).toHaveLength(4);
    expect(
      selected.filter((item) => item.difficulty === "medium"),
    ).toHaveLength(4);
    expect(
      selected.filter((item) => item.difficulty === "hard"),
    ).toHaveLength(2);
    expect(
      selected.filter((item) => item.type === "true_false").length,
    ).toBeLessThanOrEqual(3);
  });
});
