import { z } from "zod";

export const assignmentTypeSchema = z.enum(["quiz", "scenario"]);
export const assignmentStatusSchema = z.enum([
  "assigned",
  "in_progress",
  "completed",
]);

export const createAssignmentInputSchema = z
  .object({
    learnerId: z.string().uuid(),
    assignedById: z.string().uuid(),
    assignmentType: assignmentTypeSchema,
    targetId: z.string().uuid(),
    dueAt: z.string().datetime().optional(),
    createdAt: z.string().datetime(),
  })
  .superRefine((input, context) => {
    if (
      input.dueAt &&
      new Date(input.dueAt).getTime() <=
        new Date(input.createdAt).getTime()
    ) {
      context.addIssue({
        code: "custom",
        path: ["dueAt"],
        message: "截止时间必须晚于创建时间。",
      });
    }
  });

export const trainingAssignmentSchema = z.object({
  id: z.string().uuid(),
  learnerId: z.string().uuid(),
  learnerName: z.string().trim().min(1),
  assignedById: z.string().uuid(),
  assignmentType: assignmentTypeSchema,
  targetId: z.string().uuid(),
  targetLabel: z.string().trim().min(1),
  launchHref: z.string().startsWith("/practice/"),
  status: assignmentStatusSchema,
  dueAt: z.string().datetime().optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});

export type CreateAssignmentInput = z.infer<
  typeof createAssignmentInputSchema
>;
export type TrainingAssignment = z.infer<
  typeof trainingAssignmentSchema
>;
export type AssignmentFilters = {
  learnerId?: string;
  assignmentType?: z.infer<typeof assignmentTypeSchema>;
  status?: z.infer<typeof assignmentStatusSchema>;
};
