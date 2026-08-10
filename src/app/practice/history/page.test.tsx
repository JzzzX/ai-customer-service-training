import { describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect,
}));

import PracticeHistoryPage from "./page";

describe("PracticeHistoryPage", () => {
  it("redirects legacy history links to the quiz tab in the learner profile", async () => {
    await PracticeHistoryPage();

    expect(redirect).toHaveBeenCalledWith("/practice/profile?tab=quiz");
  });
});
