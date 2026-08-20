import { describe, expect, it } from "vitest";

import { evaluateProductionSnapshot } from "./production-verification";

const technicalSnapshot = {
  activeKnowledgeCount: 1,
  questionCount: 40,
  publishedQuizCount: 0,
  publishedQuizKnowledgeMismatchCount: 0,
  publishedScenarioCount: 8,
  publishedScenarioKnowledgeMismatchCount: 0,
  activeLearnerCount: 1,
  activeAdminCount: 1,
  publishedTopicCount: 5,
  publishedTopicCategoryCount: 5,
  publishedTopicKnowledgeMismatchCount: 0,
  topicQuestionCount: 350,
};

describe("evaluateProductionSnapshot", () => {
  it("separates technical readiness from formal content readiness", () => {
    const result = evaluateProductionSnapshot(technicalSnapshot);

    expect(result.technicalPassed).toBe(true);
    expect(result.formalPassed).toBe(false);
    expect(result.formalIssues).toContain(
      "正式题组尚未发布。",
    );
  });

  it("passes formal readiness with one published quiz", () => {
    const result = evaluateProductionSnapshot({
      ...technicalSnapshot,
      publishedQuizCount: 1,
    });

    expect(result.technicalPassed).toBe(true);
    expect(result.formalPassed).toBe(true);
  });

  it("requires a live administrator but not manual quiz review records", () => {
    const missingAdminSnapshot = {
      ...technicalSnapshot,
      activeAdminCount: 0,
      currentApprovalCount: 0,
    };
    const result = evaluateProductionSnapshot(missingAdminSnapshot);

    expect(result.technicalPassed).toBe(false);
    expect(result.technicalIssues).toContain("至少需要一个启用中的管理员账号。");
  });

  it("rejects inconsistent production references and content counts", () => {
    const result = evaluateProductionSnapshot({
      ...technicalSnapshot,
      activeKnowledgeCount: 2,
      questionCount: 39,
      publishedScenarioCount: 7,
      publishedScenarioKnowledgeMismatchCount: 1,
      publishedTopicCount: 4,
      publishedTopicCategoryCount: 4,
      publishedTopicKnowledgeMismatchCount: 1,
      topicQuestionCount: 349,
    });

    expect(result.technicalPassed).toBe(false);
    expect(result.technicalIssues).toEqual(
      expect.arrayContaining([
        "必须且只能有一个活动知识版本。",
        "活动知识版本必须有40道题目。",
        "必须发布8个场景版本。",
        "场景版本必须全部引用活动知识版本。",
        "必须发布5个专题题组。",
        "专题题库必须包含350道题和5个分类。",
        "专题题组必须引用活动知识版本。",
      ]),
    );
  });
});
