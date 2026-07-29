import { constants } from "node:fs";
import {
  access,
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import { quizDraftPackSchema } from "./schema";
import type { QuizDraftPack } from "./schema";

interface PublishQuizDraftPackInput {
  pack: QuizDraftPack;
  outputDir: string;
}

interface PublishQuizDraftPackResult {
  createdFiles: string[];
  packPath: string;
  latestPath: string;
}

export async function publishQuizDraftPack(
  input: PublishQuizDraftPackInput,
): Promise<PublishQuizDraftPackResult> {
  const pack = quizDraftPackSchema.parse(input.pack);
  if (pack.status !== "draft") {
    throw new Error("自动生成的小测包必须保持草稿态。");
  }

  const outputDir = resolve(input.outputDir);
  const packPath = join(outputDir, `draft-${pack.quizHash}.json`);
  const latestPath = join(outputDir, "latest.json");
  const createdFiles: string[] = [];

  await mkdir(outputDir, { recursive: true });
  if (await writeImmutableJson(packPath, pack)) {
    createdFiles.push(packPath);
  }
  if (
    await writeJsonIfChanged(latestPath, {
      schemaVersion: pack.schemaVersion,
      quizHash: pack.quizHash,
      knowledgePackHash: pack.knowledgePackHash,
      status: pack.status,
      draftFile: basename(packPath),
    })
  ) {
    createdFiles.push(latestPath);
  }

  return { createdFiles, packPath, latestPath };
}

async function writeImmutableJson(
  path: string,
  value: unknown,
): Promise<boolean> {
  const content = serializeJson(value);
  if (await fileExists(path)) {
    const existing = await readFile(path, "utf8");
    if (existing !== content) {
      throw new Error(`Immutable quiz artifact differs: ${path}`);
    }
    return false;
  }
  await writeAtomically(path, content);
  return true;
}

async function writeJsonIfChanged(
  path: string,
  value: unknown,
): Promise<boolean> {
  const content = serializeJson(value);
  if (await fileExists(path)) {
    const existing = await readFile(path, "utf8");
    if (existing === content) {
      return false;
    }
  }
  await writeAtomically(path, content);
  return true;
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

function serializeJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
