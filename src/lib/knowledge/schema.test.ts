import { describe, expect, it } from "vitest";

import { knowledgeUnitSchema } from "./schema";

const validUnit = {
  id: "ku_0123456789abcdef01234567",
  title: "换粮建议",
  content: "建议采用七日换粮法。",
  categoryPath: ["售前接待", "喂养建议"],
  contentHash:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  sources: [
    {
      sourcePath: "销售场景.md",
      kind: "markdown",
      anchor: "h:售前接待/换粮建议",
      line: 12,
      path: ["售前接待", "换粮建议"],
    },
  ],
};

describe("knowledgeUnitSchema", () => {
  it("rejects units without usable training content", () => {
    expect(() =>
      knowledgeUnitSchema.parse({ ...validUnit, content: "  " }),
    ).toThrow();
  });

  it("accepts a traceable normalized knowledge unit", () => {
    expect(knowledgeUnitSchema.parse(validUnit)).toEqual(validUnit);
  });
});
