import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { DbAssignmentStore } from "./db-assignment-store";
import type { DatabaseClient } from "../client";
import {
  knowledgeVersions,
  quizSets,
  users,
} from "../schema";
import { createTestDatabase } from "../test-support/create-test-database";

const adminId = "00000000-0000-4000-8000-000000000001";
const learnerId = "00000000-0000-4000-8000-000000000002";
const inactiveLearnerId =
  "00000000-0000-4000-8000-000000000003";
const knowledgeVersionId =
  "00000000-0000-4000-8000-000000000020";
const quizSetId = "00000000-0000-4000-8000-000000000030";

describe("DbAssignmentStore", () => {
  let client: Awaited<
    ReturnType<typeof createTestDatabase>
  >["client"];
  let database: Awaited<
    ReturnType<typeof createTestDatabase>
  >["database"];
  let store: DbAssignmentStore;

  beforeEach(async () => {
    ({ client, database } = await createTestDatabase());
    await database.insert(users).values([
      {
        id: adminId,
        email: "admin@example.com",
        name: "管理员",
        passwordHash: "not-used",
        role: "admin",
      },
      {
        id: learnerId,
        email: "learner@example.com",
        name: "学员",
        passwordHash: "not-used",
        role: "learner",
      },
      {
        id: inactiveLearnerId,
        email: "inactive@example.com",
        name: "停用学员",
        passwordHash: "not-used",
        role: "learner",
        isActive: false,
      },
    ]);
    await database.insert(knowledgeVersions).values({
      id: knowledgeVersionId,
      versionHash: "a".repeat(64),
      schemaVersion: 1,
      sourceRoot: "TOC售前客服知识库",
      status: "published",
      isActive: true,
      coverage: {},
      createdById: adminId,
    });
    await database.insert(quizSets).values({
      id: quizSetId,
      knowledgeVersionId,
      quizHash: "b".repeat(64),
      sourceQuizHash: "c".repeat(64),
      title: "正式知识小测",
      status: "published",
      passingScore: 80,
      publishedAt: new Date(),
      createdById: adminId,
    });
    store = new DbAssignmentStore(
      database as unknown as DatabaseClient,
    );
  });

  afterEach(async () => {
    await client.close();
  });

  it("creates and lists an assignment for an active learner and published target", async () => {
    const assignment = await store.create({
      learnerId,
      assignedById: adminId,
      assignmentType: "quiz",
      targetId: quizSetId,
      dueAt: "2026-08-01T01:00:00.000Z",
      createdAt: "2026-07-30T01:00:00.000Z",
    });

    expect(assignment).toMatchObject({
      learnerId,
      learnerName: "学员",
      assignmentType: "quiz",
      targetId: quizSetId,
      targetLabel: "正式知识小测",
      status: "assigned",
    });
    await expect(store.listForLearner(learnerId)).resolves.toEqual([
      assignment,
    ]);
    await expect(
      store.listForAdmin({ status: "assigned" }),
    ).resolves.toEqual([assignment]);
  });

  it("rejects inactive learners and unpublished targets", async () => {
    await expect(
      store.create({
        learnerId: inactiveLearnerId,
        assignedById: adminId,
        assignmentType: "quiz",
        targetId: quizSetId,
        createdAt: "2026-07-30T01:00:00.000Z",
      }),
    ).rejects.toThrow("学员账号不存在或未启用");

    await database
      .update(quizSets)
      .set({ status: "draft" })
      .where(eq(quizSets.id, quizSetId));
    await expect(
      store.create({
        learnerId,
        assignedById: adminId,
        assignmentType: "quiz",
        targetId: quizSetId,
        createdAt: "2026-07-30T01:00:00.000Z",
      }),
    ).rejects.toThrow("训练目标不存在或未发布");
  });
});
