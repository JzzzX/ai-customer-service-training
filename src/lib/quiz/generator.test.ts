import { describe, expect, it } from "vitest";

import { generateQuizDraftPack } from "./generator";
import type { KnowledgePack, KnowledgeUnit } from "@/lib/knowledge/schema";

function unit(index: number, category = "产品"): KnowledgeUnit {
  const hex = index.toString(16).padStart(24, "0");

  return {
    id: `ku_${hex}`,
    title: `知识问题${index}？`,
    content: `这是知识问题${index}的标准答案与处理原则。`,
    categoryPath: [category, `分类${index % 5}`],
    semanticKey: `qa:知识问题${index}`,
    contentHash: index.toString(16).padStart(64, "0"),
    sources: [
      {
        sourcePath: "企划问答.xlsx",
        kind: "excel",
        anchor: `sheet:产品/row:${index + 1}`,
        sheet: "产品",
        row: index + 1,
        path: ["产品", `知识问题${index}`],
      },
    ],
  };
}

function pack(units: KnowledgeUnit[]): KnowledgePack {
  return {
    schemaVersion: 1,
    packHash: "a".repeat(64),
    sourceRoot: "TOC售前客服知识库",
    sources: [],
    units,
    issues: [],
    coverage: {
      sourceFiles: 1,
      markdownFiles: 0,
      workbookFiles: 1,
      mindmapFiles: 0,
      workbookSheets: 1,
      spreadsheetRows: units.length,
      mindmapNodes: 0,
      mindmapUrls: 0,
      markdownImages: 0,
      workbookImages: 0,
      skippedImages: 0,
      unitsBeforeDedup: units.length,
      unitsAfterDedup: units.length,
      duplicatesMerged: 0,
      conflicts: 0,
      emptyItemsSkipped: 0,
      parseErrors: 0,
    },
    gate: { passed: true, checks: [] },
  };
}

describe("generateQuizDraftPack", () => {
  it("generates 40 deterministic source-bound drafts with an even type split", () => {
    const knowledge = pack(
      Array.from({ length: 60 }, (_, index) =>
        unit(index + 1, index % 2 === 0 ? "产品" : "客服服务流程"),
      ),
    );

    const first = generateQuizDraftPack({ knowledge, count: 40 });
    const second = generateQuizDraftPack({ knowledge, count: 40 });

    expect(first).toEqual(second);
    expect(first.questions).toHaveLength(40);
    expect(new Set(first.questions.map((question) => question.id)).size).toBe(
      40,
    );
    expect(
      first.questions.filter((question) => question.type === "single_choice"),
    ).toHaveLength(20);
    expect(
      first.questions.filter((question) => question.type === "true_false"),
    ).toHaveLength(20);
    expect(first.questions.every((question) => question.status === "draft")).toBe(
      true,
    );
    expect(
      first.questions.every(
        (question) =>
          question.knowledgeUnitId.startsWith("ku_") &&
          question.sources.length > 0 &&
          question.correctAnswers.length === 1 &&
          question.options.includes(question.correctAnswers[0] ?? "") &&
          new Set(question.options).size === question.options.length,
      ),
    ).toBe(true);
  });

  it("excludes every unit involved in a knowledge conflict", () => {
    const conflicted = unit(1);
    const knowledge = pack(
      Array.from({ length: 12 }, (_, index) => unit(index + 1)),
    );
    knowledge.issues.push({
      code: "conflict",
      severity: "warning",
      message: "同一问题存在不同答案",
      sources: conflicted.sources,
    });

    const result = generateQuizDraftPack({ knowledge, count: 10 });

    expect(
      result.questions.some(
        (question) => question.knowledgeUnitId === conflicted.id,
      ),
    ).toBe(false);
  });

  it("fails closed when there are not enough reviewable knowledge units", () => {
    expect(() =>
      generateQuizDraftPack({
        knowledge: pack([unit(1), unit(2), unit(3)]),
        count: 4,
      }),
    ).toThrow("至少需要 4 个可出题知识单元");
  });
});
