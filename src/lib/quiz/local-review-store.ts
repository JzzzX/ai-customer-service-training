import { constants } from "node:fs";
import {
  access,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { z } from "zod";

import {
  approveQuizQuestion,
  createQuizReview,
  publishQuizReview,
  quizReviewSchema,
} from "./review";
import type { QuizReview } from "./review";
import {
  quizDraftPackSchema,
  quizPublishedPackSchema,
} from "./schema";
import type { QuizPublishedPack } from "./schema";
import type {
  ApproveStoredQuestionInput,
  QuizReviewStore,
} from "./review-store";

const draftPointerSchema = z.object({
  schemaVersion: z.literal(1),
  quizHash: z.string().regex(/^[a-f0-9]{64}$/),
  knowledgePackHash: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.literal("draft"),
  draftFile: z.string().trim().min(1),
});

const publishedPointerSchema = z.object({
  schemaVersion: z.literal(1),
  quizHash: z.string().regex(/^[a-f0-9]{64}$/),
  sourceQuizHash: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.literal("published"),
  publishedFile: z.string().trim().min(1),
});

export class LocalQuizReviewStore implements QuizReviewStore {
  private readonly outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = resolve(outputDir);
  }

  async loadReview(): Promise<QuizReview> {
    const pointer = draftPointerSchema.parse(
      await readJson(join(this.outputDir, "latest.json")),
    );
    ensureLocalFilename(pointer.draftFile);
    const draft = quizDraftPackSchema.parse(
      await readJson(join(this.outputDir, pointer.draftFile)),
    );
    const reviewPath = this.reviewPath(draft.quizHash);

    if (await fileExists(reviewPath)) {
      const review = quizReviewSchema.parse(await readJson(reviewPath));
      if (review.sourceQuizHash !== draft.quizHash) {
        throw new Error("审题记录与当前草稿版本不匹配。");
      }
      return review;
    }

    return createQuizReview(draft);
  }

  async approveQuestion(
    input: ApproveStoredQuestionInput,
  ): Promise<QuizReview> {
    const review = approveQuizQuestion(await this.loadReview(), input);
    await writeJsonAtomically(
      this.reviewPath(review.sourceQuizHash),
      review,
    );
    return review;
  }

  async publish(): Promise<QuizPublishedPack> {
    const published = publishQuizReview(await this.loadReview(), {
      requireApproval: false,
    });
    const publishedFile = `published-${published.quizHash}.json`;
    const publishedPath = join(this.outputDir, publishedFile);

    await writeImmutableJson(publishedPath, published);
    await writeJsonAtomically(join(this.outputDir, "published-latest.json"), {
      schemaVersion: published.schemaVersion,
      quizHash: published.quizHash,
      sourceQuizHash: published.sourceQuizHash,
      status: published.status,
      publishedFile,
    });
    return published;
  }

  async loadPublished(): Promise<QuizPublishedPack | null> {
    const pointerPath = join(this.outputDir, "published-latest.json");
    if (!(await fileExists(pointerPath))) {
      return null;
    }

    const pointer = publishedPointerSchema.parse(await readJson(pointerPath));
    ensureLocalFilename(pointer.publishedFile);
    const published = quizPublishedPackSchema.parse(
      await readJson(join(this.outputDir, pointer.publishedFile)),
    );
    if (
      published.quizHash !== pointer.quizHash ||
      published.sourceQuizHash !== pointer.sourceQuizHash
    ) {
      throw new Error("已发布题组与发布指针不匹配。");
    }
    return published;
  }

  private reviewPath(sourceQuizHash: string): string {
    return join(this.outputDir, `review-${sourceQuizHash}.json`);
  }
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeImmutableJson(
  path: string,
  value: unknown,
): Promise<void> {
  const content = serializeJson(value);
  if (await fileExists(path)) {
    const existing = await readFile(path, "utf8");
    if (existing !== content) {
      throw new Error(`Immutable quiz artifact differs: ${path}`);
    }
    return;
  }
  await writeAtomically(path, content);
}

async function writeJsonAtomically(
  path: string,
  value: unknown,
): Promise<void> {
  await writeAtomically(path, serializeJson(value));
}

async function writeAtomically(path: string, content: string): Promise<void> {
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, content, "utf8");
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

function ensureLocalFilename(filename: string): void {
  if (basename(filename) !== filename) {
    throw new Error("题组指针包含无效文件名。");
  }
}

function serializeJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
