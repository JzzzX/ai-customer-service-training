import { describe, expect, it } from "vitest";

import { AssignmentService } from "./assignment-service";
import type {
  AssignmentStore,
  CreateAssignmentInput,
} from "./assignment-store";

class MemoryAssignmentStore implements AssignmentStore {
  created: CreateAssignmentInput[] = [];

  async create(input: CreateAssignmentInput) {
    this.created.push(input);
    return {
      id: "00000000-0000-4000-8000-000000000100",
      learnerId: input.learnerId,
      learnerName: "测试学员",
      assignedById: input.assignedById,
      assignmentType: input.assignmentType,
      targetId: input.targetId,
      targetLabel: "正式训练内容",
      status: "assigned" as const,
      ...(input.dueAt ? { dueAt: input.dueAt } : {}),
      createdAt: input.createdAt,
    };
  }

  async listForLearner() {
    return [];
  }

  async listForAdmin() {
    return [];
  }
}

describe("AssignmentService", () => {
  it("rejects a due date before the assignment creation time", async () => {
    const store = new MemoryAssignmentStore();
    const service = new AssignmentService(store);

    await expect(
      service.create({
        learnerId: "00000000-0000-4000-8000-000000000002",
        assignedById: "00000000-0000-4000-8000-000000000001",
        assignmentType: "quiz",
        targetId: "00000000-0000-4000-8000-000000000030",
        dueAt: "2026-07-30T01:00:00.000Z",
        createdAt: "2026-07-30T02:00:00.000Z",
      }),
    ).rejects.toThrow("截止时间必须晚于创建时间");
    expect(store.created).toHaveLength(0);
  });

  it("passes a valid immutable target assignment to the store", async () => {
    const store = new MemoryAssignmentStore();
    const service = new AssignmentService(store);
    const input = {
      learnerId: "00000000-0000-4000-8000-000000000002",
      assignedById: "00000000-0000-4000-8000-000000000001",
      assignmentType: "scenario" as const,
      targetId: "00000000-0000-4000-8000-000000000040",
      dueAt: "2026-08-01T01:00:00.000Z",
      createdAt: "2026-07-30T02:00:00.000Z",
    };

    await expect(service.create(input)).resolves.toMatchObject({
      assignmentType: "scenario",
      targetId: input.targetId,
      status: "assigned",
    });
    expect(store.created).toEqual([input]);
  });
});
