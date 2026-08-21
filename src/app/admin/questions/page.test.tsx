import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  list: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/db/admin-question-repository", () => ({
  createAdminQuestionRepository: () => ({ list: mocks.list }),
}));

import AdminQuestionsPage from "./page";

describe("AdminQuestionsPage", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockReset().mockResolvedValue({ id: "admin-1", role: "admin" });
    mocks.list.mockReset().mockResolvedValue([{
      catalogId: "catalog-1",
      stableKey: "qq_admin_1",
      current: revision("current-1", 2, "published", "修订题干"),
      history: [
        revision("current-1", 2, "published", "修订题干"),
        revision("old-1", 1, "published", "原题干"),
      ],
    }]);
  });

  it("applies filters and shows current revision, source, and complete history", async () => {
    render(await AdminQuestionsPage({
      searchParams: Promise.resolve({
        category: "售前",
        status: "published",
        stableKey: "qq_admin",
        keyword: "蛋白",
      }),
    }));

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.list).toHaveBeenCalledWith({
      category: "售前",
      status: "published",
      stableKey: "qq_admin",
      keyword: "蛋白",
    });
    expect(screen.getByRole("heading", { name: "题库修订" })).toBeInTheDocument();
    expect(screen.getByText("qq_admin_1")).toBeInTheDocument();
    expect(screen.getAllByText("产品.md · 蛋白含量").length).toBeGreaterThan(0);
    expect(screen.getByText("版本 2")).toBeInTheDocument();
    expect(screen.getByText("版本 1")).toBeInTheDocument();
    expect(screen.getAllByText("原题干").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/32%/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("产品资料标注为 40%。").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/创建人/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "保存为新草稿" })).toBeInTheDocument();
  });

  it("stops before reading questions when the live admin guard rejects access", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("FORBIDDEN"));
    await expect(AdminQuestionsPage()).rejects.toThrow("FORBIDDEN");
    expect(mocks.list).not.toHaveBeenCalled();
  });
});

function revision(id: string, revisionNumber: number, status: "draft" | "published", prompt: string) {
  return {
    id,
    revision: revisionNumber,
    prompt,
    options: ["32%", "40%"],
    correctAnswers: ["40%"],
    explanation: "产品资料标注为 40%。",
    category: "售前",
    difficulty: "easy" as const,
    sources: [{ sourcePath: "产品.md", kind: "markdown" as const, anchor: "蛋白含量", path: ["猫粮"] }],
    status,
    createdById: "admin-1",
    createdAt: new Date(1000),
    updatedAt: new Date(1000),
  };
}
