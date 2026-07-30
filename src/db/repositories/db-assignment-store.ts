import { and, desc, eq, type SQL } from "drizzle-orm";

import type { DatabaseClient } from "../client";
import {
  assignments,
  quizSets,
  scenarios,
  scenarioVersions,
  users,
} from "../schema";
import {
  createAssignmentInputSchema,
  trainingAssignmentSchema,
  type AssignmentFilters,
  type CreateAssignmentInput,
  type TrainingAssignment,
} from "@/lib/training/assignment-schema";
import type { AssignmentStore } from "@/lib/training/assignment-store";

type AssignmentRow = {
  id: string;
  learnerId: string;
  learnerName: string;
  assignedById: string;
  assignmentType: "quiz" | "scenario";
  quizSetId: string | null;
  quizTitle: string | null;
  scenarioVersionId: string | null;
  scenarioTitle: string | null;
  status: "assigned" | "in_progress" | "completed";
  dueAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
};

export class DbAssignmentStore implements AssignmentStore {
  constructor(private readonly database: DatabaseClient) {}

  async create(
    inputValue: CreateAssignmentInput,
  ): Promise<TrainingAssignment> {
    const input = createAssignmentInputSchema.parse(inputValue);
    await this.assertActorAndTarget(input);

    const [created] = await this.database
      .insert(assignments)
      .values({
        learnerId: input.learnerId,
        assignedById: input.assignedById,
        assignmentType: input.assignmentType,
        quizSetId:
          input.assignmentType === "quiz" ? input.targetId : null,
        scenarioVersionId:
          input.assignmentType === "scenario" ? input.targetId : null,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        createdAt: new Date(input.createdAt),
      })
      .returning({ id: assignments.id });
    if (!created) {
      throw new Error("训练任务创建失败。");
    }

    const [assignment] = await this.selectAssignments([
      eq(assignments.id, created.id),
    ]);
    if (!assignment) {
      throw new Error("训练任务创建后读取失败。");
    }
    return mapAssignment(assignment);
  }

  async listForLearner(
    learnerId: string,
  ): Promise<TrainingAssignment[]> {
    return (
      await this.selectAssignments([
        eq(assignments.learnerId, learnerId),
      ])
    ).map(mapAssignment);
  }

  async listForAdmin(
    filters: AssignmentFilters = {},
  ): Promise<TrainingAssignment[]> {
    const conditions: SQL[] = [];
    if (filters.learnerId) {
      conditions.push(eq(assignments.learnerId, filters.learnerId));
    }
    if (filters.assignmentType) {
      conditions.push(
        eq(assignments.assignmentType, filters.assignmentType),
      );
    }
    if (filters.status) {
      conditions.push(eq(assignments.status, filters.status));
    }
    return (await this.selectAssignments(conditions)).map(mapAssignment);
  }

  private async assertActorAndTarget(input: CreateAssignmentInput) {
    const [learner] = await this.database
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.id, input.learnerId),
          eq(users.role, "learner"),
          eq(users.isActive, true),
        ),
      )
      .limit(1);
    if (!learner) {
      throw new Error("学员账号不存在或未启用。");
    }

    const [admin] = await this.database
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.id, input.assignedById),
          eq(users.role, "admin"),
          eq(users.isActive, true),
        ),
      )
      .limit(1);
    if (!admin) {
      throw new Error("管理员账号不存在或未启用。");
    }

    const target =
      input.assignmentType === "quiz"
        ? await this.database
            .select({ id: quizSets.id })
            .from(quizSets)
            .where(
              and(
                eq(quizSets.id, input.targetId),
                eq(quizSets.status, "published"),
              ),
            )
            .limit(1)
        : await this.database
            .select({ id: scenarioVersions.id })
            .from(scenarioVersions)
            .where(
              and(
                eq(scenarioVersions.id, input.targetId),
                eq(scenarioVersions.status, "published"),
              ),
            )
            .limit(1);
    if (!target[0]) {
      throw new Error("训练目标不存在或未发布。");
    }
  }

  private selectAssignments(conditions: SQL[]) {
    return this.database
      .select({
        id: assignments.id,
        learnerId: assignments.learnerId,
        learnerName: users.name,
        assignedById: assignments.assignedById,
        assignmentType: assignments.assignmentType,
        quizSetId: assignments.quizSetId,
        quizTitle: quizSets.title,
        scenarioVersionId: assignments.scenarioVersionId,
        scenarioTitle: scenarios.title,
        status: assignments.status,
        dueAt: assignments.dueAt,
        startedAt: assignments.startedAt,
        completedAt: assignments.completedAt,
        createdAt: assignments.createdAt,
      })
      .from(assignments)
      .innerJoin(users, eq(assignments.learnerId, users.id))
      .leftJoin(quizSets, eq(assignments.quizSetId, quizSets.id))
      .leftJoin(
        scenarioVersions,
        eq(assignments.scenarioVersionId, scenarioVersions.id),
      )
      .leftJoin(
        scenarios,
        eq(scenarioVersions.scenarioId, scenarios.id),
      )
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(assignments.createdAt), desc(assignments.id));
  }
}

function mapAssignment(row: AssignmentRow): TrainingAssignment {
  const isQuiz = row.assignmentType === "quiz";
  const targetId = isQuiz ? row.quizSetId : row.scenarioVersionId;
  const targetLabel = isQuiz ? row.quizTitle : row.scenarioTitle;
  if (!targetId || !targetLabel) {
    throw new Error("训练任务目标数据不完整。");
  }

  return trainingAssignmentSchema.parse({
    id: row.id,
    learnerId: row.learnerId,
    learnerName: row.learnerName,
    assignedById: row.assignedById,
    assignmentType: row.assignmentType,
    targetId,
    targetLabel,
    status: row.status,
    ...(row.dueAt ? { dueAt: row.dueAt.toISOString() } : {}),
    ...(row.startedAt
      ? { startedAt: row.startedAt.toISOString() }
      : {}),
    ...(row.completedAt
      ? { completedAt: row.completedAt.toISOString() }
      : {}),
    createdAt: row.createdAt.toISOString(),
  });
}
