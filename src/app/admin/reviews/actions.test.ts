import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  decide: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireAdmin: mocks.requireAdmin,
}));
vi.mock("@/lib/runtime/services", () => ({
  getReviewService: () => ({ decide: mocks.decide }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { decideReviewAction } from "./actions";

describe("decideReviewAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000001",
    });
  });

  it("submits an adjusted score as an immutable review decision", async () => {
    const form = new FormData();
    form.set(
      "reportId",
      "00000000-0000-4000-8000-000000000060",
    );
    form.set("status", "adjusted");
    form.set("correctedVerdict", "needs_retry");
    form.set("correctedScore", "65");
    form.set("comment", "补充考虑沟通表现，仍需重练。");

    await decideReviewAction(form);

    expect(mocks.decide).toHaveBeenCalledWith({
      reportId: "00000000-0000-4000-8000-000000000060",
      reviewerId: "00000000-0000-4000-8000-000000000001",
      status: "adjusted",
      correctedVerdict: "needs_retry",
      correctedScore: 65,
      comment: "补充考虑沟通表现，仍需重练。",
    });
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/admin/reviews?reviewed=1",
    );
  });
});
