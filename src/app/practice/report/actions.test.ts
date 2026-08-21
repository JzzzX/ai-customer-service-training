import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireLearner: vi.fn(), generate: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireLearner: mocks.requireLearner }));
vi.mock("@/lib/remediation/service", () => ({ generateRemediationExam: mocks.generate }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { generateRemediationExamAction } from "./actions";

describe("generateRemediationExamAction", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.requireLearner.mockResolvedValue({ id: "learner-1", role: "learner" }); });
  it("uses the live learner identity and redirects to the generated exam", async () => {
    mocks.generate.mockReturnValue({ status: "created", exam: { id: "exam-1" } });
    const form = new FormData(); form.set("preset", "today");
    await generateRemediationExamAction(form);
    expect(mocks.requireLearner).toHaveBeenCalledOnce();
    expect(mocks.generate).toHaveBeenCalledWith("learner-1", { preset: "today" });
    expect(mocks.redirect).toHaveBeenCalledWith("/practice/remediation/exam-1");
  });

  it("preserves the actual five-question category quota in an insufficient-bank redirect", async () => {
    mocks.generate.mockReturnValue({ status: "insufficient_bank", category: "日常问答", required: 5, available: 4 });
    const form = new FormData(); form.set("preset", "today");
    await generateRemediationExamAction(form);
    expect(mocks.redirect).toHaveBeenCalledWith("/practice/report?remediation=insufficient-bank&category=%E6%97%A5%E5%B8%B8%E9%97%AE%E7%AD%94&required=5&available=4");
  });
});
