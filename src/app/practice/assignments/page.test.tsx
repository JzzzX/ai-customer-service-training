import { describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect,
}));

import PracticeAssignmentsPage from "./page";

describe("PracticeAssignmentsPage", () => {
  it("redirects legacy assignment links to the tasks tab in the learner profile", async () => {
    await PracticeAssignmentsPage();

    expect(redirect).toHaveBeenCalledWith("/practice/profile?tab=tasks");
  });
});
