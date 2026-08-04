import { describe, expect, it } from "vitest";

import { quizTopics, topicQuizQuestions } from "./question-bank";
import { selectQuestionGroupByTopic } from "./select-question-group";

const TOPICS = [
  "产品属性及卖点",
  "宠物生理和喂养",
  "活动促销",
  "服务流程与规则",
  "日常问答",
];

describe("question-bank true/false distribution", () => {
  it("has at least 18 true-false questions per topic", () => {
    for (const topic of TOPICS) {
      const count = topicQuizQuestions.filter(
        (question) => question.category === topic && question.type === "true_false",
      ).length;
      expect(
        count,
        `${topic} should have >= 18 true-false questions`,
      ).toBeGreaterThanOrEqual(18);
    }
  });

  it("has at least 25 single-choice questions per topic", () => {
    for (const topic of TOPICS) {
      const count = topicQuizQuestions.filter(
        (question) =>
          question.category === topic && question.type === "single_choice",
      ).length;
      expect(
        count,
        `${topic} should have >= 25 single-choice questions`,
      ).toBeGreaterThanOrEqual(25);
    }
  });

  it("has at least 40 total questions per topic", () => {
    for (const topic of TOPICS) {
      const count = topicQuizQuestions.filter(
        (question) => question.category === topic,
      ).length;
      expect(
        count,
        `${topic} should have >= 40 total questions`,
      ).toBeGreaterThanOrEqual(40);
    }
  });
});

describe("question-bank integrity", () => {
  it("uses globally unique question and knowledge-unit identifiers", () => {
    const questionIds = topicQuizQuestions.map((question) => question.id);
    const knowledgeUnitIds = topicQuizQuestions.map(
      (question) => question.knowledgeUnitId,
    );

    expect(new Set(questionIds).size).toBe(questionIds.length);
    expect(new Set(knowledgeUnitIds).size).toBe(knowledgeUnitIds.length);
  });

  it("uses the canonical options and one valid answer for every true-false question", () => {
    const trueFalseQuestions = topicQuizQuestions.filter(
      (question) => question.type === "true_false",
    );

    for (const question of trueFalseQuestions) {
      expect(question.options).toEqual(["正确", "错误"]);
      expect(question.correctAnswers).toHaveLength(1);
      expect(["正确", "错误"]).toContain(question.correctAnswers[0]);
    }
  });

  it("can allocate a balanced 10-question group for every configured topic", () => {
    for (const topic of quizTopics) {
      const selected = selectQuestionGroupByTopic(
        topicQuizQuestions,
        topic.id,
      );

      expect(selected).toHaveLength(10);
      expect(new Set(selected.map((question) => question.id)).size).toBe(10);
      expect(
        selected.every((question) => question.category === topic.id),
      ).toBe(true);
      expect(
        selected.filter((question) => question.type === "single_choice"),
      ).toHaveLength(5);
      expect(
        selected.filter((question) => question.type === "true_false"),
      ).toHaveLength(5);
      expect(
        selected.filter((question) => question.difficulty === "easy"),
      ).toHaveLength(4);
      expect(
        selected.filter((question) => question.difficulty === "medium"),
      ).toHaveLength(4);
      expect(
        selected.filter((question) => question.difficulty === "hard"),
      ).toHaveLength(2);
    }
  });
});
