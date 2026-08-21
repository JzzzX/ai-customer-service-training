// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/guards", () => ({ requireAdmin: vi.fn() }));

import { createAdminQuestionActions } from "./actions";

describe("admin question actions", () => {
  it("re-checks the live admin role before every mutation", async () => {
    const requireAdmin = vi
      .fn()
      .mockResolvedValueOnce({ id: "admin-1", role: "admin" })
      .mockRejectedValueOnce(new Error("已撤销管理员权限"));
    const repository = {
      createDraft: vi.fn().mockResolvedValue({ id: "draft-1" }),
      publishDraft: vi.fn(),
    };
    const actions = createAdminQuestionActions({
      requireAdmin,
      repository: repository as never,
      revalidate: vi.fn(),
    });

    await actions.createDraft({
      catalogId: "catalog-1",
      baseRevisionId: "question-1",
      changes: {
        prompt: "题干",
        options: ["A", "B"],
        correctAnswers: ["A"],
        explanation: "解析",
        category: "分类",
        difficulty: "easy",
      },
    });
    await expect(
      actions.publishDraft({
        catalogId: "catalog-1",
        draftRevisionId: "draft-1",
        expectedCurrentRevisionId: "question-1",
      }),
    ).rejects.toThrow("已撤销管理员权限");

    expect(requireAdmin).toHaveBeenCalledTimes(2);
    expect(repository.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "admin-1" }),
    );
    expect(repository.publishDraft).not.toHaveBeenCalled();
  });
});
