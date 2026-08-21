// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { createAdminQuestionRepository } from "@/db/admin-question-repository";
import { ensureQuestionRevision } from "@/db/question-revision-publication";
import { knowledgeVersions, users } from "@/db/schema";
import { createTestDatabase } from "@/db/test-support/create-test-database";
import { requireAdmin } from "@/lib/auth/guards";

import { createAdminQuestionActions } from "./actions";

describe("admin question action authorization integration", () => {
  const clients: Array<{ close(): void }> = [];

  afterEach(() => clients.splice(0).forEach((client) => client.close()));

  it("rejects publication after the database role is revoked even when the JWT still says admin", async () => {
    const fixture = await createTestDatabase();
    clients.push(fixture.client);
    await fixture.database.insert(users).values({
      id: "admin-1", email: "admin@example.test", name: "管理员", passwordHash: "disabled", role: "admin", isActive: true,
    });
    await fixture.database.insert(knowledgeVersions).values({
      id: "knowledge-1", versionHash: "1".repeat(64), contentHash: "2".repeat(64), schemaVersion: 1,
      sourceRoot: "action-test", status: "published", isActive: true, coverage: {}, publishedAt: new Date(1000),
    });
    fixture.database.transaction((transaction) => ensureQuestionRevision(transaction, {
      stableKey: "qq_action_0000000000000001", knowledgeVersionId: "knowledge-1", knowledgeUnitId: null,
      knowledgeUnitKey: "ku_action", type: "single_choice", prompt: "原题", options: ["A", "B"],
      correctAnswers: ["A"], explanation: "原解析", category: "售前", difficulty: "easy",
      sources: [{ sourcePath: "产品.md", kind: "markdown", anchor: "原题", path: ["售前"] }],
    }));
    const repository = createAdminQuestionRepository(fixture.database);
    const liveGuard = () => requireAdmin({
      authenticate: async () => ({
        user: { id: "admin-1", email: "admin@example.test", name: "管理员", role: "admin" },
        expires: "2099-01-01T00:00:00.000Z",
      }),
      database: fixture.database,
      deny: (path) => { throw new Error(path); },
    });
    const actions = createAdminQuestionActions({ requireAdmin: liveGuard, repository, revalidate: vi.fn() });
    const current = (await repository.list({}))[0]!;
    const draft = await actions.createDraft({
      catalogId: current.catalogId,
      baseRevisionId: current.current.id,
      changes: { prompt: "新题", options: ["A", "B"], correctAnswers: ["B"], explanation: "新解析", category: "售前", difficulty: "medium" },
    });

    // The test keeps the stale JWT above and changes only live database state.
    await fixture.database.update(users).set({ role: "learner" }).where(eq(users.id, "admin-1"));

    await expect(actions.publishDraft({
      catalogId: current.catalogId,
      draftRevisionId: draft.id,
      expectedCurrentRevisionId: current.current.id,
    })).rejects.toThrow("/forbidden");
    expect((await repository.list({}))[0]!.current.id).toBe(current.current.id);
  });
});
