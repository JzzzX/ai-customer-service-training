import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  create: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireAdmin: mocks.requireAdmin,
}));
vi.mock("@/lib/runtime/services", () => ({
  getAssignmentService: () => ({ create: mocks.create }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { createAssignmentAction } from "./actions";

describe("createAssignmentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000001",
    });
  });

  it("creates an assignment from an immutable typed target", async () => {
    const form = new FormData();
    form.set(
      "learnerId",
      "00000000-0000-4000-8000-000000000002",
    );
    form.set(
      "target",
      "scenario:00000000-0000-4000-8000-000000000030",
    );
    form.set("dueAt", "2026-08-01T14:00");

    await createAssignmentAction(form);

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        learnerId: "00000000-0000-4000-8000-000000000002",
        assignedById: "00000000-0000-4000-8000-000000000001",
        assignmentType: "scenario",
        targetId: "00000000-0000-4000-8000-000000000030",
      }),
    );
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/admin/assignments?created=1",
    );
  });
});
