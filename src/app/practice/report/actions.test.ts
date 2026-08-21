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
});
