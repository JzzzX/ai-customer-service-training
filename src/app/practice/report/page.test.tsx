import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), getReport: vi.fn(), parseRange: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/report/service", () => ({
  getLearningQuizReport: mocks.getReport,
  parseReportRange: mocks.parseRange,
}));

import PracticeReportPage from "./page";

describe("PracticeReportPage", () => {
  beforeEach(() => {
    mocks.requireUser.mockReset().mockResolvedValue({ id: "learner-self", name: "娄伊娜", role: "learner" });
    mocks.getReport.mockReset().mockResolvedValue(reportFixture());
    mocks.parseRange.mockReset().mockImplementation((params: { preset?: string; start?: string; end?: string }) =>
      params.preset === "custom"
        ? { preset: "custom", startDate: params.start, endDate: params.end }
        : { preset: params.preset ?? "today" },
    );
  });

  it("always loads the signed-in learner and labels quiz-only evidence", async () => {
    render(await PracticeReportPage({
      searchParams: Promise.resolve({ preset: "custom", start: "2026-08-20", end: "2026-08-21", learnerId: "victim" }),
    }));
    expect(mocks.getReport).toHaveBeenCalledWith("learner-self", {
      preset: "custom", startDate: "2026-08-20", endDate: "2026-08-21",
    });
    expect(screen.getByRole("heading", { name: "知识测试整体报告" })).toBeInTheDocument();
    expect(screen.getByText(/情景实战不在本报告中/)).toBeInTheDocument();
    expect(screen.getByText("高频错点")).toBeInTheDocument();
    expect(screen.getByText("本期错题")).toBeInTheDocument();
    expect(screen.getByText("历史题干")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /生成 10 题改善考卷/ })).toBeInTheDocument();
  });

  it("shows an invalid custom range without querying report data", async () => {
    mocks.parseRange.mockImplementationOnce(() => { throw new Error("日期范围错误"); });
    render(await PracticeReportPage({ searchParams: Promise.resolve({ preset: "custom", start: "2026-08-22", end: "2026-08-21" }) }));
    expect(mocks.getReport).not.toHaveBeenCalled();
    expect(screen.getByText(/日期范围无效/)).toBeInTheDocument();
  });

  it("shows the real five-question quota when a two-category bank is short", async () => {
    render(await PracticeReportPage({ searchParams: Promise.resolve({ remediation: "insufficient-bank", category: "日常问答", required: "5", available: "4" }) }));
    expect(screen.getByText(/不足 5 题（可用 4 题）/)).toBeInTheDocument();
    expect(screen.queryByText(/不足 10 题/)).not.toBeInTheDocument();
  });
});

function reportFixture() {
  return {
    learner: { id: "learner-self", name: "娄伊娜", email: "lou@example.test" },
    range: { preset: "custom", startDate: "2026-08-20", endDate: "2026-08-21", startAt: "2026-08-19T16:00:00.000Z", endExclusiveAt: "2026-08-21T16:00:00.000Z" },
    summary: { completedAttempts: 2, answeredCount: 3, correctCount: 1, accuracy: 33, passedAttempts: 1, passRate: 50 },
    trend: [{ date: "2026-08-21", completedAttempts: 2, answeredCount: 3, correctCount: 1, accuracy: 33 }],
    categories: [{ category: "产品属性及卖点", answeredCount: 3, wrongCount: 2, errorRate: 67, latestWrongAt: "2026-08-21T01:00:00.000Z" }],
    questionWeaknesses: [
      { stableKey: "q-1", category: "产品属性及卖点", classification: "high_frequency", answeredCount: 2, wrongCount: 2, errorRate: 100, latestWrongAt: "2026-08-21T01:00:00.000Z", evidence: [{ attemptId: "a-1", source: "standard", revisionId: "rev-1", prompt: "历史题干", selectedAnswers: ["错误"], correctAnswers: ["正确"], explanation: "历史解析", answeredAt: "2026-08-21T01:00:00.000Z", isCorrect: false }] },
      { stableKey: "q-2", category: "服务流程与规则", classification: "period_mistake", answeredCount: 1, wrongCount: 1, errorRate: 100, latestWrongAt: "2026-08-20T01:00:00.000Z", evidence: [{ attemptId: "a-2", source: "legacy", revisionId: null, prompt: null, selectedAnswers: ["未知"], correctAnswers: null, explanation: null, answeredAt: "2026-08-20T01:00:00.000Z", isCorrect: false }] },
    ],
    remediationExams: [],
  };
}
