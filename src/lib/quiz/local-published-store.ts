import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import { z } from "zod";

import { quizPublishedPackSchema, type QuizPublishedPack } from "./schema";
import type { PublishedQuizStore } from "./published-store";

const publishedPointerSchema = z.object({
  schemaVersion: z.literal(1),
  quizHash: z.string().regex(/^[a-f0-9]{64}$/),
  sourceQuizHash: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.literal("published"),
  publishedFile: z.string().trim().min(1),
});

export class LocalPublishedQuizStore implements PublishedQuizStore {
  constructor(private readonly outputDir: string) {}

  async loadPublished(): Promise<QuizPublishedPack | null> {
    const directory = resolve(this.outputDir);
    const pointerPath = join(directory, "published-latest.json");
    if (!(await fileExists(pointerPath))) {
      return null;
    }

    const pointer = publishedPointerSchema.parse(await readJson(pointerPath));
    if (basename(pointer.publishedFile) !== pointer.publishedFile) {
      throw new Error("题组指针包含无效文件名。");
    }
    const published = quizPublishedPackSchema.parse(
      await readJson(join(directory, pointer.publishedFile)),
    );
    if (
      published.quizHash !== pointer.quizHash ||
      published.sourceQuizHash !== pointer.sourceQuizHash
    ) {
      throw new Error("已发布题组与发布指针不匹配。");
    }
    return published;
  }
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
