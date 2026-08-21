import { describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() => vi.fn());
const requireLearner = vi.hoisted(() => vi.fn().mockResolvedValue({ id: "learner-1" }));

vi.mock("next/navigation", () => ({
  redirect,
}));
vi.mock("@/lib/auth/guards", () => ({ requireLearner }));

import PracticeHistoryPage from "./page";

describe("PracticeHistoryPage", () => {
  it("redirects legacy history links to the quiz tab in the learner profile", async () => {
    await PracticeHistoryPage();

    expect(requireLearner).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledWith("/practice/profile?tab=quiz");
  });
});
