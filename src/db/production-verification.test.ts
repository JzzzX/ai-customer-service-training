import { describe, expect, it } from "vitest";

import { evaluateProductionSnapshot } from "./production-verification";

const technicalSnapshot = {
  activeKnowledgeCount: 1,
  questionCount: 40,
  currentApprovalCount: 1,
  publishedQuizCount: 0,
  publishedQuizKnowledgeMismatchCount: 0,
  publishedScenarioCount: 8,
  publishedScenarioKnowledgeMismatchCount: 0,
  activeAdminCount: 1,
  activeLearnerCount: 1,
};

describe("evaluateProductionSnapshot", () => {
  it("separates technical readiness from formal content readiness", () => {
    const result = evaluateProductionSnapshot(technicalSnapshot);

    expect(result.technicalPassed).toBe(true);
    expect(result.formalPassed).toBe(false);
    expect(result.formalIssues).toContain(
      "正式题组尚未在40/40人工审核后发布。",
    );
  });

  it("passes formal readiness only with 40 approvals and one published quiz", () => {
    const result = evaluateProductionSnapshot({
      ...technicalSnapshot,
      currentApprovalCount: 40,
      publishedQuizCount: 1,
    });

    expect(result.technicalPassed).toBe(true);
    expect(result.formalPassed).toBe(true);
  });

  it("rejects inconsistent production references and content counts", () => {
    const result = evaluateProductionSnapshot({
      ...technicalSnapshot,
      activeKnowledgeCount: 2,
      questionCount: 39,
      publishedScenarioCount: 7,
      publishedScenarioKnowledgeMismatchCount: 1,
    });

    expect(result.technicalPassed).toBe(false);
    expect(result.technicalIssues).toEqual(
      expect.arrayContaining([
        "必须且只能有一个活动知识版本。",
        "活动知识版本必须有40道题目。",
        "必须发布8个场景版本。",
        "场景版本必须全部引用活动知识版本。",
      ]),
    );
  });
});
