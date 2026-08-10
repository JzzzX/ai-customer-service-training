import { readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import { z } from "zod";

import { quizDraftPackSchema } from "./schema";
import type { QuizDraftPack } from "./schema";

const draftPointerSchema = z.object({
  schemaVersion: z.literal(1),
  quizHash: z.string().regex(/^[a-f0-9]{64}$/),
  knowledgePackHash: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.literal("draft"),
  draftFile: z.string().trim().min(1),
});

export async function loadQuizDraftArtifact(
  outputDirInput: string,
): Promise<QuizDraftPack> {
  const outputDir = resolve(outputDirInput);
  const pointer = draftPointerSchema.parse(
    JSON.parse(await readFile(join(outputDir, "latest.json"), "utf8")),
  );
  if (basename(pointer.draftFile) !== pointer.draftFile) {
    throw new Error("题组指针包含无效文件名。");
  }

  const draft = quizDraftPackSchema.parse(
    JSON.parse(
      await readFile(join(outputDir, pointer.draftFile), "utf8"),
    ),
  );
  if (
    draft.quizHash !== pointer.quizHash ||
    draft.knowledgePackHash !== pointer.knowledgePackHash
  ) {
    throw new Error("题库草稿与本地指针不匹配。");
  }
  return draft;
}
