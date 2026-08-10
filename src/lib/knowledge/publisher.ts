import { constants } from "node:fs";
import {
  access,
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import { knowledgePackSchema } from "./schema";
import type { KnowledgePack } from "./schema";

interface PublishKnowledgePackInput {
  pack: KnowledgePack;
  outputDir: string;
}

interface PublishKnowledgePackResult {
  createdFiles: string[];
  packPath: string;
  coveragePath: string;
  latestPath: string;
}

export async function publishKnowledgePack(
  input: PublishKnowledgePackInput,
): Promise<PublishKnowledgePackResult> {
  const pack = knowledgePackSchema.parse(input.pack);

  if (!pack.gate.passed) {
    throw new Error(
      "Knowledge pack failed the coverage gate and cannot be published.",
    );
  }

  const outputDir = resolve(input.outputDir);
  const packName = `pack-${pack.packHash}.json`;
  const coverageName = `coverage-${pack.packHash}.json`;
  const packPath = join(outputDir, packName);
  const coveragePath = join(outputDir, coverageName);
  const latestPath = join(outputDir, "latest.json");
  const createdFiles: string[] = [];

  await mkdir(outputDir, { recursive: true });

  if (await writeImmutableJson(packPath, pack)) {
    createdFiles.push(packPath);
  }

  const coverageReport = {
    schemaVersion: pack.schemaVersion,
    packHash: pack.packHash,
    sourceRoot: pack.sourceRoot,
    sources: pack.sources,
    coverage: pack.coverage,
    gate: pack.gate,
    issues: pack.issues,
  };

  if (await writeImmutableJson(coveragePath, coverageReport)) {
    createdFiles.push(coveragePath);
  }

  if (
    await writeJsonIfChanged(latestPath, {
      schemaVersion: pack.schemaVersion,
      packHash: pack.packHash,
      packFile: basename(packPath),
      coverageFile: basename(coveragePath),
    })
  ) {
    createdFiles.push(latestPath);
  }

  return {
    createdFiles,
    packPath,
    coveragePath,
    latestPath,
  };
}

async function writeImmutableJson(path: string, value: unknown): Promise<boolean> {
  const content = serializeJson(value);

  if (await fileExists(path)) {
    const existing = await readFile(path, "utf8");
    if (existing !== content) {
      throw new Error(`Immutable knowledge artifact differs: ${path}`);
    }
    return false;
  }

  await writeAtomically(path, content);
  return true;
}

async function writeJsonIfChanged(path: string, value: unknown): Promise<boolean> {
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
