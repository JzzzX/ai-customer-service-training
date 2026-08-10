import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { publishKnowledgePack } from "./publisher";
import type { KnowledgePack } from "./schema";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

function pack(gatePassed = true): KnowledgePack {
  return {
    schemaVersion: 1,
    packHash:
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    sourceRoot: "知识库",
    sources: [],
    units: [],
    issues: [],
    coverage: {
      sourceFiles: 0,
      markdownFiles: 0,
      workbookFiles: 0,
      mindmapFiles: 0,
      workbookSheets: 0,
      spreadsheetRows: 0,
      mindmapNodes: 0,
      mindmapUrls: 0,
      markdownImages: 0,
      workbookImages: 0,
      skippedImages: 0,
      unitsBeforeDedup: 0,
      unitsAfterDedup: 0,
      duplicatesMerged: 0,
      conflicts: 0,
      emptyItemsSkipped: 0,
      parseErrors: 0,
    },
    gate: {
      passed: gatePassed,
      checks: [],
    },
  };
}

describe("publishKnowledgePack", () => {
  it("writes one immutable artifact set across repeated publication", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "knowledge-publish-"));
    temporaryDirectories.push(outputDir);

    const first = await publishKnowledgePack({ pack: pack(), outputDir });
    const second = await publishKnowledgePack({ pack: pack(), outputDir });

    expect(first.createdFiles).toHaveLength(3);
    expect(second.createdFiles).toEqual([]);
    expect((await readdir(outputDir)).sort()).toEqual(
      [
        "coverage-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.json",
        "latest.json",
        "pack-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.json",
      ].sort(),
    );
  });

  it("refuses to publish a pack that failed coverage checks", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "knowledge-publish-"));
    temporaryDirectories.push(outputDir);

    await expect(
      publishKnowledgePack({ pack: pack(false), outputDir }),
    ).rejects.toThrow("coverage gate");
  });

  it("refuses malformed pack metadata before writing files", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "knowledge-publish-"));
    temporaryDirectories.push(outputDir);
    const malformed = { ...pack(), packHash: "" };

    await expect(
      publishKnowledgePack({ pack: malformed, outputDir }),
    ).rejects.toThrow();
    expect(await readdir(outputDir)).toEqual([]);
  });
});
