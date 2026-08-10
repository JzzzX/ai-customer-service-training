import { describe, expect, it, vi } from "vitest";

import {
  prepareKnowledgePublication,
  publishKnowledgePackToStore,
} from "./knowledge-publication";
import type { KnowledgePackStore } from "./knowledge-publication";
import type { KnowledgePack } from "@/lib/knowledge/schema";

function pack(gatePassed = true): KnowledgePack {
  return {
    schemaVersion: 1,
    packHash:
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    sourceRoot: "TOC售前客服知识库",
    sources: [
      {
        sourcePath: "企划问答.xlsx",
        kind: "excel",
        sourceHash:
          "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        bytes: 100,
        stats: { sheetsSeen: 1 },
      },
    ],
    units: [
      {
        id: "ku_0123456789abcdef01234567",
        title: "幼猫怎么喂",
        content: "少量多餐。",
        categoryPath: ["产品"],
        semanticKey: "qa:幼猫怎么喂",
        contentHash:
          "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        sources: [
          {
            sourcePath: "企划问答.xlsx",
            kind: "excel",
            anchor: "sheet:产品/row:2",
            sheet: "产品",
            row: 2,
            path: ["产品", "幼猫怎么喂"],
          },
        ],
      },
    ],
    issues: [
      {
        code: "conflict",
        severity: "warning",
        message: "Conflicting answer.",
        sources: [
          {
            sourcePath: "企划问答.xlsx",
            kind: "excel",
            anchor: "sheet:产品/row:2",
            sheet: "产品",
            row: 2,
            path: ["产品", "幼猫怎么喂"],
          },
        ],
      },
    ],
    coverage: {
      sourceFiles: 1,
      markdownFiles: 0,
      workbookFiles: 1,
      mindmapFiles: 0,
      workbookSheets: 1,
      spreadsheetRows: 1,
      mindmapNodes: 0,
      mindmapUrls: 0,
      markdownImages: 0,
      workbookImages: 0,
      skippedImages: 0,
      unitsBeforeDedup: 1,
      unitsAfterDedup: 1,
      duplicatesMerged: 0,
      conflicts: 1,
      emptyItemsSkipped: 0,
      parseErrors: 0,
    },
    gate: {
      passed: gatePassed,
      checks: [],
    },
  };
}

describe("knowledge database publication", () => {
  it("marks conflicting units as unavailable for automatic training use", () => {
    const publication = prepareKnowledgePublication(pack());

    expect(publication.units[0]).toMatchObject({
      unitKey: "ku_0123456789abcdef01234567",
      hasConflict: true,
      canUseForQuiz: false,
      canUseForScenario: false,
      canUseForEvaluation: false,
    });
  });

  it("returns an existing immutable version without publishing again", async () => {
    const store: KnowledgePackStore = {
      findVersionByHash: vi.fn(async () => ({
        id: "existing-version",
        versionHash: pack().packHash,
      })),
      publishAtomically: vi.fn(),
    };

    await expect(publishKnowledgePackToStore(pack(), store)).resolves.toEqual({
      created: false,
      id: "existing-version",
      versionHash: pack().packHash,
    });
    expect(store.publishAtomically).not.toHaveBeenCalled();
  });

  it("refuses packs that failed the coverage gate", async () => {
    const store: KnowledgePackStore = {
      findVersionByHash: vi.fn(),
      publishAtomically: vi.fn(),
    };

    await expect(
      publishKnowledgePackToStore(pack(false), store),
    ).rejects.toThrow("coverage gate");
    expect(store.findVersionByHash).not.toHaveBeenCalled();
    expect(store.publishAtomically).not.toHaveBeenCalled();
  });
});
