import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), listLearners: vi.fn(), getReport: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/report/service", () => ({
  listReportLearners: mocks.listLearners,
  getLearningQuizReport: mocks.getReport,
  parseReportRange: (params: { preset?: string }) => ({ preset: params.preset ?? "today" }),
}));

import AdminReportsPage from "./page";

describe("AdminReportsPage", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockReset().mockResolvedValue({ id: "admin-1", role: "admin" });
    mocks.listLearners.mockReset().mockReturnValue([{ id: "learner-1", name: "娄伊娜", email: "lou@example.test" }]);
    mocks.getReport.mockReset().mockResolvedValue({
      learner: { id: "learner-1", name: "娄伊娜", email: "lou@example.test" },
      range: { preset: "today", startDate: "2026-08-21", endDate: "2026-08-21", startAt: "2026-08-20T16:00:00.000Z", endExclusiveAt: "2026-08-21T16:00:00.000Z" },
      summary: { completedAttempts: 0, answeredCount: 0, correctCount: 0, accuracy: 0, passedAttempts: 0, passRate: 0 },
      trend: [], categories: [], questionWeaknesses: [],
    });
  });

  it("checks live admin access before searching learners and displays a selected learner read-only", async () => {
    render(await AdminReportsPage({ searchParams: Promise.resolve({ q: "娄", learnerId: "learner-1", preset: "today" }) }));
    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.listLearners).toHaveBeenCalledWith("娄");
    expect(mocks.getReport).toHaveBeenCalledWith("learner-1", { preset: "today" });
    expect(screen.getByRole("heading", { name: "学员知识测试报告" })).toBeInTheDocument();
    expect(screen.getAllByText("娄伊娜")).toHaveLength(2);
    expect(screen.getByText(/暂无已完成的知识测试/)).toBeInTheDocument();
  });

  it("does not read report data when the live guard rejects access", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("FORBIDDEN"));
    await expect(AdminReportsPage()).rejects.toThrow("FORBIDDEN");
    expect(mocks.listLearners).not.toHaveBeenCalled();
    expect(mocks.getReport).not.toHaveBeenCalled();
  });
});
