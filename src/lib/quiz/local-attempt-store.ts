import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { z } from "zod";

import { finishQuizAttempt } from "./attempt";
import {
  quizAttemptRecordSchema,
  saveQuizAttemptInputSchema,
  type QuizAttemptRecord,
  type QuizAttemptStore,
  type SaveQuizAttemptInput,
} from "./attempt-store";

const quizAttemptRecordsSchema = z.array(quizAttemptRecordSchema);

export class LocalQuizAttemptStore implements QuizAttemptStore {
  private readonly outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = resolve(outputDir);
  }

  async saveAttempt(
    inputValue: SaveQuizAttemptInput,
  ): Promise<QuizAttemptRecord> {
    const input = saveQuizAttemptInputSchema.parse(inputValue);
    const learnerId = input.learnerId;
    const path = this.attemptsPath(learnerId);
    const attempts = await this.readAttempts(path);
    const existing = attempts.find(
      (attempt) => attempt.id === input.attemptId,
    );
    if (existing) {
      return existing;
    }

    const correctCount = input.answers.filter(
      (answer) => answer.isCorrect,
    ).length;
    const missedQuestionIds = input.answers
      .filter((answer) => !answer.isCorrect)
      .map((answer) => answer.questionId);
    const outcome = finishQuizAttempt({
      passingScore: input.passingScore,
      correctCount,
      totalQuestions: input.answers.length,
    });
    const record = quizAttemptRecordSchema.parse({
      id: input.attemptId,
      learnerId,
      quizHash: input.quizHash,
      ...(input.assignmentId
        ? { assignmentId: input.assignmentId }
        : {}),
      status: outcome.status,
      correctCount,
      totalQuestions: input.answers.length,
      score: outcome.score,
      missedQuestionIds,
      completedAt: input.completedAt ?? new Date().toISOString(),
    });

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
