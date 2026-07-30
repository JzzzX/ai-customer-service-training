import { describe, expect, it } from "vitest";

import { ReviewService } from "./review-service";
import type {
  ReviewDecisionInput,
  ReviewStore,
} from "./review-store";

class MemoryReviewStore implements ReviewStore {
  decisions: ReviewDecisionInput[] = [];

  async listPending() {
    return [];
  }

  async load() {
    return null;
  }

  async decide(input: ReviewDecisionInput) {
    this.decisions.push(input);
    return {
      reportId: input.reportId,
      learnerId: "00000000-0000-4000-8000-000000000002",
      learnerName: "测试学员",
      scenarioTitle: "测试场景",
      totalScore: 60,
      verdict: "needs_retry" as const,
      confidence: 0.92,
      dimensions: [
        { name: "需求识别", score: 10, maxScore: 20, evidence: [] },
        { name: "流程完整", score: 10, maxScore: 20, evidence: [] },
        { name: "知识准确", score: 10, maxScore: 20, evidence: [] },
        { name: "沟通体验", score: 10, maxScore: 20, evidence: [] },
        { name: "风险控制", score: 20, maxScore: 20, evidence: [] },
      ],
      strengths: ["表达清晰"],
      missedSteps: ["未追问宠物年龄"],
      risks: [],
      recommendations: ["先确认宠物基本信息"],
      referenceReply: "您好，请问宠物的年龄和体重是多少？",
      reviewTrigger: "failed" as const,
      transcript: [],
      createdAt: "2026-07-30T02:00:00.000Z",
      decision: input,
    };
  }
}

describe("ReviewService", () => {
  it("requires corrected score and verdict only for adjusted decisions", async () => {
    const service = new ReviewService(new MemoryReviewStore());

    await expect(
      service.decide({
        reportId: "00000000-0000-4000-8000-000000000070",
        reviewerId: "00000000-0000-4000-8000-000000000001",
        status: "adjusted",
        comment: "需要调整",
      }),
    ).rejects.toThrow("调整结论必须填写修正分数和结论");
  });

  it("rejects corrected fields for a confirmed decision", async () => {
    const service = new ReviewService(new MemoryReviewStore());

    await expect(
      service.decide({
        reportId: "00000000-0000-4000-8000-000000000070",
        reviewerId: "00000000-0000-4000-8000-000000000001",
        status: "confirmed",
        correctedScore: 80,
        correctedVerdict: "passed",
        comment: "确认",
      }),
    ).rejects.toThrow("仅调整结论可以填写修正字段");
  });
});
