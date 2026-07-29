import { describe, expect, it } from "vitest";

import { finalizeRawUnits } from "./compiler";
import type { RawKnowledgeUnit } from "./schema";

const firstSource = {
  sourcePath: "产品问答.xlsx",
  kind: "excel" as const,
  anchor: "sheet:产品/row:2",
  sheet: "产品",
  row: 2,
  path: ["产品", "幼猫粮", "三个月幼猫怎么喂"],
};

function unit(
  overrides: Partial<RawKnowledgeUnit> = {},
): RawKnowledgeUnit {
  return {
    title: "三个月幼猫怎么喂",
    content: "用温水泡软。",
    categoryPath: ["产品", "幼猫粮"],
    semanticKey: "qa:三个月幼猫怎么喂",
    source: firstSource,
    ...overrides,
  };
}

describe("finalizeRawUnits", () => {
  it("merges exact duplicates while preserving every source locator", () => {
    const result = finalizeRawUnits([
      unit(),
      unit({
        source: {
          sourcePath: "新媒体问答.xlsx",
          kind: "excel",
          anchor: "sheet:问答/row:8",
          sheet: "问答",
          row: 8,
          path: ["问答", "三个月幼猫怎么喂"],
        },
      }),
    ]);

    expect(result.units).toHaveLength(1);
    expect(result.units[0]?.sources).toHaveLength(2);
    expect(result.duplicatesMerged).toBe(1);
    expect(result.issues[0]?.code).toBe("duplicate");
  });

  it("flags different answers that share the same semantic key", () => {
    const result = finalizeRawUnits([
      unit(),
      unit({
        content: "可以直接喂干粮。",
        source: {
          ...firstSource,
          anchor: "sheet:产品/row:3",
          row: 3,
        },
      }),
    ]);

    expect(result.units).toHaveLength(2);
    expect(result.conflicts).toBe(1);
    expect(result.issues[0]?.code).toBe("conflict");
  });

  it("produces the same output regardless of source discovery order", () => {
    const rows = [
      unit(),
      unit({
        title: "成猫喂多少",
        content: "按体重参考包装建议。",
        semanticKey: "qa:成猫喂多少",
        source: {
          ...firstSource,
          anchor: "sheet:产品/row:5",
          row: 5,
          path: ["产品", "成猫粮", "成猫喂多少"],
        },
      }),
    ];

    const forward = finalizeRawUnits(rows);
    const reversed = finalizeRawUnits(rows.toReversed());

    expect(forward.units.map((item) => item.title)).toEqual([
      "三个月幼猫怎么喂",
      "成猫喂多少",
    ]);
    expect(forward).toEqual(reversed);
  });
});
