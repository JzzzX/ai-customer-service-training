import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { z } from "zod";

import { finishQuizAttempt } from "./attempt";

const questionIdSchema = z.string().regex(/^qq_[a-f0-9]{24}$/);

export const quizAttemptRecordSchema = z.object({
  id: z.string().uuid(),
  learnerId: z.string().uuid(),
  quizHash: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.enum(["passed", "needs_retry"]),
  correctCount: z.number().int().min(0),
  totalQuestions: z.number().int().positive(),
  score: z.number().int().min(0).max(100),
  missedQuestionIds: z.array(questionIdSchema),
  completedAt: z.string().datetime(),
});

const quizAttemptRecordsSchema = z.array(quizAttemptRecordSchema);

export type QuizAttemptRecord = z.infer<typeof quizAttemptRecordSchema>;

type SaveAttemptInput = {
  learnerId: string;
  quizHash: string;
  passingScore: number;
  correctCount: number;
  totalQuestions: number;
  missedQuestionIds: string[];
  completedAt?: string;
};

export class LocalQuizAttemptStore {
  private readonly outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = resolve(outputDir);
  }

  async saveAttempt(input: SaveAttemptInput): Promise<QuizAttemptRecord> {
    const learnerId = z.string().uuid().parse(input.learnerId);
    const outcome = finishQuizAttempt(input);
    const record = quizAttemptRecordSchema.parse({
      id: randomUUID(),
      learnerId,
      quizHash: input.quizHash,
      status: outcome.status,
      correctCount: input.correctCount,
      totalQuestions: input.totalQuestions,
      score: outcome.score,
      missedQuestionIds: input.missedQuestionIds,
      completedAt: input.completedAt ?? new Date().toISOString(),
    });
    const path = this.attemptsPath(learnerId);
    const attempts = await this.readAttempts(path);

    await writeJsonAtomically(path, [...attempts, record]);
    return record;
  }

  async listAttempts(learnerIdInput: string): Promise<QuizAttemptRecord[]> {
    const learnerId = z.string().uuid().parse(learnerIdInput);
    const attempts = await this.readAttempts(this.attemptsPath(learnerId));
    return attempts.toSorted((left, right) =>
      right.completedAt.localeCompare(left.completedAt),
    );
  }

  private attemptsPath(learnerId: string): string {
    return join(this.outputDir, `attempts-${learnerId}.json`);
  }

  private async readAttempts(path: string): Promise<QuizAttemptRecord[]> {
    if (!(await fileExists(path))) {
      return [];
    }
    return quizAttemptRecordsSchema.parse(
      JSON.parse(await readFile(path, "utf8")),
    );
  }
}

async function writeJsonAtomically(
  path: string,
  value: unknown,
): Promise<void> {
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(
    temporaryPath,
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
  await rename(temporaryPath, path);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
